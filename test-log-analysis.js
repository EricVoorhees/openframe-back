#!/usr/bin/env node

/**
 * Test script for log analysis integration
 * Run this after starting your backend and HumanLayer daemon
 */

const axios = require('axios');

// Configuration
const BACKEND_URL = 'http://localhost:3001';
const FIREBASE_TOKEN = 'your-firebase-token-here'; // Replace with actual token

// Sample log data
const sampleLogSummary = {
  summary_id: 'test-summary-001',
  session_id: 'test-session-001',
  total_logs: 1250,
  error_count: 15,
  warn_count: 8,
  unique_errors: [
    {
      error_type: 'TypeError',
      message: 'Cannot read property \'map\' of undefined',
      count: 8,
      frequency_pattern: 'increasing'
    },
    {
      error_type: 'NetworkError',
      message: 'Failed to fetch API data',
      count: 4,
      frequency_pattern: 'sporadic'
    },
    {
      error_type: 'ValidationError',
      message: 'Invalid user input format',
      count: 3,
      frequency_pattern: 'consistent'
    }
  ],
  critical_logs: [
    {
      timestamp: '2024-01-15T10:30:00Z',
      level: 'ERROR',
      message: 'Database connection failed',
      frame_name: 'UserService'
    },
    {
      timestamp: '2024-01-15T10:31:15Z',
      level: 'ERROR',
      message: 'Cannot read property \'map\' of undefined',
      frame_name: 'ComponentRenderer'
    },
    {
      timestamp: '2024-01-15T10:32:30Z',
      level: 'WARN',
      message: 'Slow query detected (2.5s)',
      frame_name: 'DatabaseQuery'
    }
  ],
  network_summary: {
    total_requests: 450,
    success_rate: 92.4,
    failed_requests: 34
  },
  performance_alerts: [
    {
      severity: 'HIGH',
      message: 'Component render time exceeded 500ms',
      duration_ms: 750
    },
    {
      severity: 'MEDIUM',
      message: 'Memory usage above 80%',
      duration_ms: 0
    }
  ]
};

async function testLogAnalysis() {
  try {
    console.log('🧪 Testing log analysis integration...\n');

    // Test 1: Health check
    console.log('1. Testing health check...');
    try {
      const healthResponse = await axios.get(`${BACKEND_URL}/health`);
      console.log('✅ Backend health:', healthResponse.data.status);
    } catch (error) {
      console.log('❌ Backend health check failed:', error.message);
      return;
    }

    // Test 2: Log analysis health
    console.log('\n2. Testing log analysis service health...');
    try {
      const logHealthResponse = await axios.get(`${BACKEND_URL}/api/logs/health`, {
        headers: {
          'Authorization': `Bearer ${FIREBASE_TOKEN}`
        }
      });
      console.log('✅ Log analysis service:', logHealthResponse.data.status);
    } catch (error) {
      console.log('❌ Log analysis health check failed:', error.response?.data || error.message);
      if (error.response?.status === 401) {
        console.log('💡 Note: Update FIREBASE_TOKEN in this script with a valid token');
        return;
      }
    }

    // Test 3: Analyze logs
    console.log('\n3. Testing log analysis...');
    try {
      const analysisResponse = await axios.post(
        `${BACKEND_URL}/api/logs/analyze`,
        sampleLogSummary,
        {
          headers: {
            'Authorization': `Bearer ${FIREBASE_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ Log analysis completed successfully!');
      console.log('\n📊 Analysis Results:');
      console.log('-------------------');
      console.log('📝 Narrative:', analysisResponse.data.narrative);
      console.log('\n🔍 Key Insights:');
      analysisResponse.data.key_insights.forEach((insight, i) => {
        console.log(`   ${i + 1}. ${insight}`);
      });
      console.log('\n💡 Recommendations:');
      analysisResponse.data.recommendations.forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec}`);
      });

    } catch (error) {
      console.log('❌ Log analysis failed:', error.response?.data || error.message);
      if (error.response?.status === 401) {
        console.log('💡 Note: Update FIREBASE_TOKEN in this script with a valid token');
      }
    }

    console.log('\n🎉 Test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Usage instructions
if (FIREBASE_TOKEN === 'your-firebase-token-here') {
  console.log('⚠️  Please update the FIREBASE_TOKEN in this script before running');
  console.log('');
  console.log('To get a Firebase token:');
  console.log('1. Open your frontend app');
  console.log('2. Login with Firebase Auth');
  console.log('3. Check browser dev tools > Application > Local Storage');
  console.log('4. Copy the ID token and paste it in this script');
  console.log('');
  console.log('Or run this test after setting up proper authentication in your frontend.');
} else {
  testLogAnalysis();
}