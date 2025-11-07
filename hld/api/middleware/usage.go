package middleware

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	"your-project/hld/firebase"
)

// UsageMiddleware handles Firebase authentication and usage tracking
type UsageMiddleware struct {
	firebaseClient *firebase.Client
	enabled        bool
}

// NewUsageMiddleware creates a new usage tracking middleware
func NewUsageMiddleware(ctx context.Context) (*UsageMiddleware, error) {
	// Check if usage tracking is enabled
	enabled := os.Getenv("ENABLE_USAGE_TRACKING") == "true"
	if !enabled {
		slog.Info("Usage tracking is disabled")
		return &UsageMiddleware{enabled: false}, nil
	}

	// Initialize Firebase client
	fbClient, err := firebase.NewClient(ctx)
	if err != nil {
		return nil, err
	}

	slog.Info("Usage tracking middleware initialized")
	return &UsageMiddleware{
		firebaseClient: fbClient,
		enabled:        true,
	}, nil
}

// CheckAuth middleware verifies Firebase token and checks points balance
func (m *UsageMiddleware) CheckAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Skip if usage tracking is disabled
		if !m.enabled {
			next.ServeHTTP(w, r)
			return
		}

		// Extract Authorization header
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, `{"error":"missing_authorization","message":"Authorization header required"}`, http.StatusUnauthorized)
			return
		}

		// Extract token
		token := strings.TrimPrefix(authHeader, "Bearer ")
		if token == authHeader {
			http.Error(w, `{"error":"invalid_authorization","message":"Bearer token required"}`, http.StatusUnauthorized)
			return
		}

		// Verify Firebase token
		userID, err := m.firebaseClient.VerifyToken(r.Context(), token)
		if err != nil {
			slog.Error("token verification failed", "error", err)
			http.Error(w, `{"error":"invalid_token","message":"Authentication failed"}`, http.StatusUnauthorized)
			return
		}

		// Get user's current points
		points, err := m.firebaseClient.GetUserPoints(r.Context(), userID)
		if err != nil {
			slog.Error("failed to get user points", "user_id", userID, "error", err)
			http.Error(w, `{"error":"internal_error","message":"Failed to check balance"}`, http.StatusInternalServerError)
			return
		}

		// Check if user has enough points (minimum 1)
		if points < 1 {
			slog.Warn("user has insufficient points", "user_id", userID, "points", points)
			http.Error(w, `{"error":"insufficient_points","message":"Not enough points. Please purchase more."}`, http.StatusPaymentRequired)
			return
		}

		// Add user ID to context
		ctx := context.WithValue(r.Context(), "user_id", userID)
		ctx = context.WithValue(ctx, "user_points", points)

		slog.Debug("user authenticated", 
			"user_id", userID, 
			"points", points,
			"path", r.URL.Path)

		// Continue to handler
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// responseWriter wraps http.ResponseWriter to capture response
type responseWriter struct {
	http.ResponseWriter
	statusCode int
	body       []byte
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

func (rw *responseWriter) Write(b []byte) (int, error) {
	rw.body = append(rw.body, b...)
	return rw.ResponseWriter.Write(b)
}

// TrackUsage middleware logs API usage and deducts points
func (m *UsageMiddleware) TrackUsage(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Skip if usage tracking is disabled
		if !m.enabled {
			next.ServeHTTP(w, r)
			return
		}

		// Get user ID from context (set by CheckAuth)
		userID, ok := r.Context().Value("user_id").(string)
		if !ok {
			// User not authenticated, skip tracking
			next.ServeHTTP(w, r)
			return
		}

		// Read request body to extract model and token info
		bodyBytes, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "Failed to read request", http.StatusBadRequest)
			return
		}
		
		// Parse request
		var reqBody map[string]interface{}
		if err := json.Unmarshal(bodyBytes, &reqBody); err != nil {
			http.Error(w, "Invalid JSON", http.StatusBadRequest)
			return
		}

		// Get model from request
		model, _ := reqBody["model"].(string)
		if model == "" {
			model = "claude-3-5-sonnet-20241022" // default
		}

		// Extract session ID from URL path
		sessionID := "unknown"
		parts := strings.Split(r.URL.Path, "/")
		if len(parts) > 0 {
			sessionID = parts[len(parts)-1]
		}

		// Start timing
		startTime := time.Now()

		// Wrap response writer to capture response
		rw := &responseWriter{
			ResponseWriter: w,
			statusCode:     http.StatusOK,
		}

		// Call next handler
		next.ServeHTTP(rw, r)

		duration := time.Since(startTime)

		// Extract token usage from response
		inputTokens := 0
		outputTokens := 0
		success := rw.statusCode >= 200 && rw.statusCode < 300
		errorMsg := ""

		if success && len(rw.body) > 0 {
			// Try to parse response to get token counts
			var respBody map[string]interface{}
			if err := json.Unmarshal(rw.body, &respBody); err == nil {
				if usage, ok := respBody["usage"].(map[string]interface{}); ok {
					if input, ok := usage["input_tokens"].(float64); ok {
						inputTokens = int(input)
					}
					if output, ok := usage["output_tokens"].(float64); ok {
						outputTokens = int(output)
					}
				}
			}
		} else if !success {
			errorMsg = string(rw.body)
		}

		// Calculate points cost
		pointsCost := firebase.CalculatePointsCost(model, inputTokens, outputTokens)

		// Deduct points
		if success && pointsCost > 0 {
			if err := m.firebaseClient.DeductPoints(r.Context(), userID, pointsCost); err != nil {
				slog.Error("failed to deduct points", 
					"user_id", userID,
					"points", pointsCost,
					"error", err)
				// Don't fail the request, just log the error
			}
		}

		// Log usage
		usageLog := firebase.UsageLog{
			UserID:       userID,
			SessionID:    sessionID,
			Model:        model,
			InputTokens:  inputTokens,
			OutputTokens: outputTokens,
			PointsCost:   pointsCost,
			Timestamp:    startTime,
			IPAddress:    getClientIP(r),
			DurationMS:   duration.Milliseconds(),
			Success:      success,
			ErrorMessage: errorMsg,
		}

		if err := m.firebaseClient.LogUsage(r.Context(), usageLog); err != nil {
			slog.Error("failed to log usage", "error", err)
			// Don't fail the request
		}

		slog.Info("request completed",
			"user_id", userID,
			"model", model,
			"input_tokens", inputTokens,
			"output_tokens", outputTokens,
			"points_cost", pointsCost,
			"duration_ms", duration.Milliseconds(),
			"success", success)
	})
}

// getClientIP extracts the client's IP address from the request
func getClientIP(r *http.Request) string {
	// Check X-Forwarded-For header first (for proxies)
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		ips := strings.Split(xff, ",")
		return strings.TrimSpace(ips[0])
	}
	
	// Check X-Real-IP header
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}
	
	// Fall back to RemoteAddr
	ip := r.RemoteAddr
	if colon := strings.LastIndex(ip, ":"); colon != -1 {
		ip = ip[:colon]
	}
	
	return ip
}




