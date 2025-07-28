'use client'

import { useMobileResponsive } from '@/hooks/useMobileResponsive'

export default function TestMobilePage() {
  const { isMobile, isTablet, isDesktop, width, height, isTouch, orientation } = useMobileResponsive()

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-900">
          📱 Mobile Responsive Hook Test
        </h1>
        
        {/* Real-time device info */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">📊 Current Device Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="font-medium">Screen Size:</span>
                <span className="text-blue-600">{width} × {height}px</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Device Type:</span>
                <span className={`font-semibold ${
                  isMobile ? 'text-green-600' : isTablet ? 'text-yellow-600' : 'text-purple-600'
                }`}>
                  {isMobile ? '📱 Mobile' : isTablet ? '📊 Tablet' : '💻 Desktop'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Touch Capable:</span>
                <span className={`font-semibold ${isTouch ? 'text-green-600' : 'text-gray-600'}`}>
                  {isTouch ? '✅ Yes' : '❌ No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Orientation:</span>
                <span className="text-indigo-600 capitalize">{orientation}</span>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="font-medium">Mobile:</span>
                <span className={`font-semibold ${isMobile ? 'text-green-600' : 'text-gray-400'}`}>
                  {isMobile ? 'TRUE' : 'false'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Tablet:</span>
                <span className={`font-semibold ${isTablet ? 'text-yellow-600' : 'text-gray-400'}`}>
                  {isTablet ? 'TRUE' : 'false'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Desktop:</span>
                <span className={`font-semibold ${isDesktop ? 'text-purple-600' : 'text-gray-400'}`}>
                  {isDesktop ? 'TRUE' : 'false'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">User Agent:</span>
                <span className="text-xs text-gray-500 truncate">
                  {typeof navigator !== 'undefined' ? 
                    (navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop') : 
                    'Unknown'
                  }
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Responsive Layout Demo */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">📐 Responsive Layout Demo</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Mobile-specific content */}
            {isMobile && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-semibold text-green-800 mb-2">📱 Mobile Only</h3>
                <p className="text-sm text-green-600">
                  This content only appears on mobile devices (≤640px)
                </p>
                <div className="mt-2 p-2 bg-green-100 rounded text-xs">
                  Single column layout
                </div>
              </div>
            )}

            {/* Tablet-specific content */}
            {isTablet && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="font-semibold text-yellow-800 mb-2">📊 Tablet Only</h3>
                <p className="text-sm text-yellow-600">
                  This content only appears on tablets (641px-1024px)
                </p>
                <div className="mt-2 p-2 bg-yellow-100 rounded text-xs">
                  Two column layout
                </div>
              </div>
            )}

            {/* Desktop-specific content */}
            {isDesktop && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h3 className="font-semibold text-purple-800 mb-2">💻 Desktop Only</h3>
                <p className="text-sm text-purple-600">
                  This content only appears on desktop (>1024px)
                </p>
                <div className="mt-2 p-2 bg-purple-100 rounded text-xs">
                  Three column layout
                </div>
              </div>
            )}

            {/* Always visible content */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-800 mb-2">🌐 All Devices</h3>
              <p className="text-sm text-blue-600">
                This content appears on all devices
              </p>
              <div className="mt-2 p-2 bg-blue-100 rounded text-xs">
                Responsive grid
              </div>
            </div>
          </div>
        </div>

        {/* Touch Demo */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">👆 Touch Interaction Demo</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button className="h-12 bg-indigo-500 text-white rounded-lg font-medium hover:bg-indigo-600 transition-colors">
              {isMobile ? 'Tap Me' : 'Click Me'}
            </button>
            <button className="h-12 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors">
              {isTouch ? 'Touch Friendly' : 'Mouse Friendly'}
            </button>
            <button className="h-12 bg-yellow-500 text-white rounded-lg font-medium hover:bg-yellow-600 transition-colors">
              {orientation === 'portrait' ? 'Portrait' : 'Landscape'}
            </button>
            <button className="h-12 bg-purple-500 text-white rounded-lg font-medium hover:bg-purple-600 transition-colors">
              {width > 768 ? 'Wide Screen' : 'Narrow Screen'}
            </button>
          </div>
        </div>

        {/* Chart Container Demo */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">📊 Chart Container Demo</h2>
          <div 
            className={`
              bg-gradient-to-br from-indigo-50 to-purple-50 
              border-2 border-dashed border-indigo-200 
              rounded-lg flex items-center justify-center
              ${isMobile ? 'h-64' : isTablet ? 'h-80' : 'h-96'}
            `}
          >
            <div className="text-center">
              <div className="text-4xl mb-2">📈</div>
              <div className="text-lg font-semibold text-gray-700">
                Responsive Chart Area
              </div>
              <div className="text-sm text-gray-500 mt-2">
                Height: {isMobile ? '256px (h-64)' : isTablet ? '320px (h-80)' : '384px (h-96)'}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Device: {isMobile ? 'Mobile' : isTablet ? 'Tablet' : 'Desktop'}
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-800 mb-2">🧪 Test Instructions</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• <strong>Desktop:</strong> Resize your browser window to see real-time changes</li>
            <li>• <strong>Mobile:</strong> Open Chrome DevTools and use device emulation</li>
            <li>• <strong>Touch Test:</strong> Try on an actual mobile device</li>
            <li>• <strong>Orientation:</strong> Rotate your mobile device to test orientation changes</li>
            <li>• <strong>Breakpoints:</strong> Mobile ≤640px, Tablet 641-1024px, Desktop >1024px</li>
          </ul>
        </div>
      </div>
    </div>
  )
}