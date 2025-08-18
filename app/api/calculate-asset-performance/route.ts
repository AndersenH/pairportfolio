import { NextRequest, NextResponse } from 'next/server';
import { pythonAssetRunner } from '@/lib/python-asset-runner';

export async function POST(request: NextRequest) {
  try {
    console.log('Asset performance calculation API called');

    // Parse request body
    const body = await request.json();
    console.log('Request body keys:', Object.keys(body));
    
    const { portfolioData, portfolioAllocation } = body;

    // Validate input
    if (!portfolioData) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing portfolioData in request body' 
        },
        { status: 400 }
      );
    }

    if (!portfolioAllocation) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing portfolioAllocation in request body' 
        },
        { status: 400 }
      );
    }

    // Validate portfolio data structure
    const { portfolioValues, returns, weights, dates } = portfolioData;
    
    if (!portfolioValues || !Array.isArray(portfolioValues) || portfolioValues.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid or empty portfolioValues array' 
        },
        { status: 400 }
      );
    }

    if (!returns || !Array.isArray(returns) || returns.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid or empty returns array' 
        },
        { status: 400 }
      );
    }

    if (!weights || typeof weights !== 'object' || Object.keys(weights).length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid or empty weights object' 
        },
        { status: 400 }
      );
    }

    if (!dates || !Array.isArray(dates) || dates.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid or empty dates array' 
        },
        { status: 400 }
      );
    }

    console.log('Input validation passed');
    console.log(`Portfolio data: ${portfolioValues.length} values, ${returns.length} returns, ${Object.keys(weights).length} assets`);

    // Extract individual asset price data if available from portfolioData
    const assetPriceData = portfolioData.assetPrices || null;
    if (assetPriceData && Object.keys(assetPriceData).length > 0) {
      console.log(`Asset price data available for: ${Object.keys(assetPriceData).join(', ')}`);
      const sampleAsset = Object.keys(assetPriceData)[0];
      if (sampleAsset && assetPriceData[sampleAsset]) {
        console.log(`Sample asset ${sampleAsset} has ${assetPriceData[sampleAsset]?.length || 0} price points`);
      }
    } else {
      console.log('No individual asset price data available - using realistic simulation');
    }

    // Test Python environment first
    const envTest = await pythonAssetRunner.testPythonEnvironment();
    if (!envTest.success) {
      console.error('Python environment test failed:', envTest.error);
      return NextResponse.json(
        { 
          success: false, 
          error: `Python environment not available: ${envTest.error}`,
          fallbackToJS: true
        },
        { status: 500 }
      );
    }

    console.log('Python environment test passed:', envTest.versions);

    // Calculate asset performance using Python
    const result = await pythonAssetRunner.calculateAssetPerformance({
      portfolioData: {
        portfolioValues,
        returns,
        weights,
        dates
      },
      portfolioAllocation,
      assetPriceData
    });

    if (!result.success) {
      console.error('Python calculation failed:', result.error);
      return NextResponse.json(
        { 
          success: false, 
          error: result.error,
          fallbackToJS: true
        },
        { status: 500 }
      );
    }

    console.log('Python calculation successful');
    console.log(`Calculated metrics for ${result.data?.length || 0} assets`);

    // Return successful result
    return NextResponse.json({
      success: true,
      data: result.data,
      metadata: {
        ...result.metadata,
        timestamp: new Date().toISOString(),
        inputValidation: 'passed',
        pythonEnvironment: envTest.versions
      }
    });

  } catch (error) {
    console.error('Asset performance calculation error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown server error',
        fallbackToJS: true
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Test endpoint for Python environment
    const envTest = await pythonAssetRunner.testPythonEnvironment();
    
    return NextResponse.json({
      success: envTest.success,
      message: envTest.success ? 'Python environment is ready' : 'Python environment has issues',
      environment: envTest.versions || envTest.error,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}