package handlers

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/humanlayer/humanlayer/hld/store"
)

// APISessionHandlers handles lightweight API-only sessions that don't launch Claude CLI
type APISessionHandlers struct {
	store store.ConversationStore
}

func NewAPISessionHandlers(store store.ConversationStore) *APISessionHandlers {
	return &APISessionHandlers{
		store: store,
	}
}

// CreateAPISessionRequest represents the request to create an API-only session
type CreateAPISessionRequest struct {
	Title    string                 `json:"title,omitempty"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

// CreateAPISessionResponse represents the response with the created session
type CreateAPISessionResponse struct {
	ID        string    `json:"id"`
	CreatedAt time.Time `json:"created_at"`
	Status    string    `json:"status"`
}

// CreateAPISession creates a lightweight session for API proxy usage only
// This does NOT launch the Claude CLI - it just creates a tracking record
func (h *APISessionHandlers) CreateAPISession(c *gin.Context) {
	var req CreateAPISessionRequest
	
	// Parse request body - allow empty body
	if c.Request.ContentLength > 0 {
		if err := c.ShouldBindJSON(&req); err != nil {
			slog.Warn("Invalid JSON in create session request",
				"error", err,
				"content_type", c.GetHeader("Content-Type"))
			c.JSON(400, gin.H{
				"error": "Invalid JSON format",
				"details": err.Error(),
			})
			return
		}
	}

	// Generate unique session ID
	sessionID := uuid.New().String()
	
	// Create title from metadata or use default
	title := req.Title
	if title == "" {
		if userID, ok := req.Metadata["user_id"].(string); ok {
			title = fmt.Sprintf("API Session - %s", userID)
		} else {
			title = "API Session"
		}
	}

	// Create session record
	session := &store.Session{
		ID:             sessionID,
		RunID:          sessionID, // Use same ID for simplicity
		ClaudeSessionID: sessionID,
		Title:          title,
		Status:         "draft", // Start as draft
		CreatedAt:      time.Now(),
		LastActivityAt: time.Now(),
		ProxyEnabled:   false, // Can be updated later if needed
	}

	// Save to database
	if err := h.store.CreateSession(context.Background(), session); err != nil {
		slog.Error("Failed to create API session",
			"session_id", sessionID,
			"error", err)
		c.JSON(500, gin.H{
			"error": "Failed to create session",
		})
		return
	}

	slog.Info("Created API-only session",
		"session_id", sessionID,
		"title", title)

	// Return session details
	c.JSON(200, CreateAPISessionResponse{
		ID:        sessionID,
		CreatedAt: session.CreatedAt,
		Status:    session.Status,
	})
}

