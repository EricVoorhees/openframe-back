package firebase

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/auth"
	"firebase.google.com/go/v4/db"
	"google.golang.org/api/option"
)

// Client handles Firebase operations
type Client struct {
	auth *auth.Client
	db   *db.Client
}

// UsageLog represents a single API usage record
type UsageLog struct {
	UserID           string    `json:"user_id"`
	SessionID        string    `json:"session_id"`
	Model            string    `json:"model"`
	InputTokens      int       `json:"input_tokens"`
	OutputTokens     int       `json:"output_tokens"`
	PointsCost       int       `json:"points_cost"`
	Timestamp        time.Time `json:"timestamp"`
	IPAddress        string    `json:"ip_address"`
	DurationMS       int64     `json:"duration_ms"`
	Success          bool      `json:"success"`
	ErrorMessage     string    `json:"error_message,omitempty"`
}

// UserData represents user information
type UserData struct {
	Email         string    `json:"email"`
	Points        int       `json:"points"`
	TotalUsed     int       `json:"total_used"`
	RequestsToday int       `json:"requests_today"`
	Plan          string    `json:"plan"`
	CreatedAt     time.Time `json:"created_at"`
	LastRequest   time.Time `json:"last_request"`
}

// NewClient creates a new Firebase client
func NewClient(ctx context.Context) (*Client, error) {
	// Get Firebase config from environment
	projectID := os.Getenv("FIREBASE_PROJECT_ID")
	if projectID == "" {
		return nil, fmt.Errorf("FIREBASE_PROJECT_ID environment variable not set")
	}

	privateKey := os.Getenv("FIREBASE_PRIVATE_KEY")
	if privateKey == "" {
		return nil, fmt.Errorf("FIREBASE_PRIVATE_KEY environment variable not set")
	}

	clientEmail := os.Getenv("FIREBASE_CLIENT_EMAIL")
	if clientEmail == "" {
		return nil, fmt.Errorf("FIREBASE_CLIENT_EMAIL environment variable not set")
	}

	// Create service account credentials
	credentials := map[string]interface{}{
		"type":                        "service_account",
		"project_id":                  projectID,
		"private_key":                 privateKey,
		"client_email":                clientEmail,
		"token_uri":                   "https://oauth2.googleapis.com/token",
	}

	credentialsJSON, err := json.Marshal(credentials)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal credentials: %w", err)
	}

	// Initialize Firebase app
	opt := option.WithCredentialsJSON(credentialsJSON)
	app, err := firebase.NewApp(ctx, nil, opt)
	if err != nil {
		return nil, fmt.Errorf("error initializing Firebase app: %w", err)
	}

	// Initialize Auth client
	authClient, err := app.Auth(ctx)
	if err != nil {
		return nil, fmt.Errorf("error initializing Auth client: %w", err)
	}

	// Initialize Realtime Database client
	dbURL := fmt.Sprintf("https://%s.firebaseio.com", projectID)
	dbClient, err := app.DatabaseWithURL(ctx, dbURL)
	if err != nil {
		return nil, fmt.Errorf("error initializing Database client: %w", err)
	}

	return &Client{
		auth: authClient,
		db:   dbClient,
	}, nil
}

// VerifyToken validates a Firebase ID token and returns the user ID
func (c *Client) VerifyToken(ctx context.Context, idToken string) (string, error) {
	token, err := c.auth.VerifyIDToken(ctx, idToken)
	if err != nil {
		return "", fmt.Errorf("error verifying token: %w", err)
	}
	return token.UID, nil
}

// GetUserPoints retrieves the current points balance for a user
func (c *Client) GetUserPoints(ctx context.Context, userID string) (int, error) {
	ref := c.db.NewRef(fmt.Sprintf("users/%s/points", userID))
	
	var points int
	if err := ref.Get(ctx, &points); err != nil {
		return 0, fmt.Errorf("error getting user points: %w", err)
	}
	
	return points, nil
}

// DeductPoints removes points from a user's balance (atomic transaction)
func (c *Client) DeductPoints(ctx context.Context, userID string, amount int) error {
	ref := c.db.NewRef(fmt.Sprintf("users/%s", userID))
	
	return ref.Transaction(ctx, func(tn db.TransactionNode) (interface{}, error) {
		var user UserData
		if err := tn.Unmarshal(&user); err != nil {
			// User doesn't exist, initialize
			user = UserData{
				Points:    0,
				TotalUsed: 0,
				Plan:      "free",
				CreatedAt: time.Now(),
			}
		}
		
		// Check if user has enough points
		if user.Points < amount {
			return nil, fmt.Errorf("insufficient points: has %d, needs %d", user.Points, amount)
		}
		
		// Deduct points
		user.Points -= amount
		user.TotalUsed += amount
		user.LastRequest = time.Now()
		
		return user, nil
	})
}

// AddPoints adds points to a user's balance
func (c *Client) AddPoints(ctx context.Context, userID string, amount int) error {
	ref := c.db.NewRef(fmt.Sprintf("users/%s", userID))
	
	return ref.Transaction(ctx, func(tn db.TransactionNode) (interface{}, error) {
		var user UserData
		if err := tn.Unmarshal(&user); err != nil {
			// User doesn't exist, initialize
			user = UserData{
				Points:    0,
				Plan:      "free",
				CreatedAt: time.Now(),
			}
		}
		
		user.Points += amount
		user.LastRequest = time.Now()
		
		return user, nil
	})
}

// LogUsage records an API usage event
func (c *Client) LogUsage(ctx context.Context, log UsageLog) error {
	ref := c.db.NewRef("usage_logs").Push(ctx)
	
	if err := ref.Set(ctx, log); err != nil {
		return fmt.Errorf("error logging usage: %w", err)
	}
	
	// Update user's requests today counter
	today := time.Now().Format("2006-01-02")
	requestsRef := c.db.NewRef(fmt.Sprintf("users/%s/requests_by_day/%s", log.UserID, today))
	
	return requestsRef.Transaction(ctx, func(tn db.TransactionNode) (interface{}, error) {
		var count int
		if err := tn.Unmarshal(&count); err != nil {
			count = 0
		}
		return count + 1, nil
	})
}

// GetUserData retrieves complete user data
func (c *Client) GetUserData(ctx context.Context, userID string) (*UserData, error) {
	ref := c.db.NewRef(fmt.Sprintf("users/%s", userID))
	
	var user UserData
	if err := ref.Get(ctx, &user); err != nil {
		return nil, fmt.Errorf("error getting user data: %w", err)
	}
	
	return &user, nil
}

// InitializeUser creates a new user with default points
func (c *Client) InitializeUser(ctx context.Context, userID string, email string) error {
	ref := c.db.NewRef(fmt.Sprintf("users/%s", userID))
	
	// Check if user already exists
	var existing UserData
	if err := ref.Get(ctx, &existing); err == nil && existing.CreatedAt.Unix() > 0 {
		// User already exists
		return nil
	}
	
	// Get default points from env or use 100
	defaultPoints := 100
	if envPoints := os.Getenv("DEFAULT_USER_POINTS"); envPoints != "" {
		fmt.Sscanf(envPoints, "%d", &defaultPoints)
	}
	
	user := UserData{
		Email:     email,
		Points:    defaultPoints,
		TotalUsed: 0,
		Plan:      "free",
		CreatedAt: time.Now(),
	}
	
	return ref.Set(ctx, user)
}

// CalculatePointsCost calculates the points cost for a request
func CalculatePointsCost(model string, inputTokens, outputTokens int) int {
	// Pricing per 1K tokens (in points)
	pricing := map[string]struct{ input, output float64 }{
		"claude-3-opus-20240229":      {input: 15.0, output: 75.0},
		"claude-3-5-sonnet-20241022":  {input: 3.0, output: 15.0},
		"claude-3-5-haiku-20241022":   {input: 0.8, output: 4.0},
		"claude-3-sonnet-20240229":    {input: 3.0, output: 15.0},
		"claude-3-haiku-20240307":     {input: 0.25, output: 1.25},
	}
	
	// Default to Sonnet pricing if model not found
	rates, ok := pricing[model]
	if !ok {
		rates = pricing["claude-3-5-sonnet-20241022"]
	}
	
	// Calculate cost
	inputCost := (float64(inputTokens) / 1000.0) * rates.input
	outputCost := (float64(outputTokens) / 1000.0) * rates.output
	
	// Round up to nearest point
	totalCost := int(inputCost + outputCost + 0.99)
	
	// Minimum 1 point per request
	if totalCost < 1 {
		totalCost = 1
	}
	
	return totalCost
}




