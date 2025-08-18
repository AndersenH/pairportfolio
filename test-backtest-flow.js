// Test script to verify backtest flow
// Run with: node test-backtest-flow.js

async function testBacktestFlow() {
  const baseUrl = 'http://localhost:3000';
  
  // Test payload matching what the form sends
  const testPayload = {
    portfolioId: "test-portfolio-id", // This will need a real portfolio ID
    startDate: "2024-01-01",
    endDate: "2024-12-31",
    initialCapital: 10000,
    benchmarkSymbol: "SPY",
    rebalancingFrequency: "monthly",
    parameters: {
      strategy: "buy-and-hold"
    }
  };

  console.log('Testing backtest API with payload:', testPayload);

  try {
    const response = await fetch(`${baseUrl}/api/backtests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(testPayload),
    });

    console.log('Response status:', response.status);
    const result = await response.json();
    console.log('Response body:', JSON.stringify(result, null, 2));

    if (result.success && result.data?.id) {
      console.log('✅ Backtest created successfully with ID:', result.data.id);
      console.log('Would redirect to:', `/backtests/${result.data.id}`);
    } else {
      console.log('❌ Unexpected response format');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testBacktestFlow();