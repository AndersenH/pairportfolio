'use client'

import { useMobileResponsive } from '@/lib/client-utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function MobileTestPage() {
  const { isMobile, isTablet, isDesktop, width, height, isTouch } = useMobileResponsive()

  return (
    <div className="container mx-auto p-4 space-y-6">
      <h1 className="text-3xl font-bold">Mobile Responsive Test Page</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Device Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Device Type</p>
              <div className="space-y-1">
                <Badge variant={isMobile ? "default" : "secondary"}>
                  Mobile: {isMobile ? 'Yes' : 'No'}
                </Badge>
                <Badge variant={isTablet ? "default" : "secondary"}>
                  Tablet: {isTablet ? 'Yes' : 'No'}
                </Badge>
                <Badge variant={isDesktop ? "default" : "secondary"}>
                  Desktop: {isDesktop ? 'Yes' : 'No'}
                </Badge>
              </div>
            </div>
            
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Dimensions</p>
              <div className="space-y-1">
                <p className="text-sm font-mono">Width: {width}px</p>
                <p className="text-sm font-mono">Height: {height}px</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Input Method</p>
              <Badge variant={isTouch ? "default" : "secondary"}>
                Touch: {isTouch ? 'Yes' : 'No'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Responsive Layout Test</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded border">
              <h3 className="font-semibold mb-2">Column 1</h3>
              <p className="text-sm text-muted-foreground">
                This content should stack on mobile and display in columns on larger screens.
              </p>
            </div>
            <div className="bg-green-50 p-4 rounded border">
              <h3 className="font-semibold mb-2">Column 2</h3>
              <p className="text-sm text-muted-foreground">
                Test responsive grid layout behavior across different screen sizes.
              </p>
            </div>
            <div className="bg-purple-50 p-4 rounded border">
              <h3 className="font-semibold mb-2">Column 3</h3>
              <p className="text-sm text-muted-foreground">
                Third column should only appear on large screens (lg breakpoint).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dynamic Behavior Test</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 border rounded">
              <h4 className="font-semibold mb-2">Current Breakpoint</h4>
              <p className="text-lg font-mono">
                {isMobile && "Mobile (≤640px)"}
                {isTablet && "Tablet (641px-1024px)"}
                {isDesktop && "Desktop (>1024px)"}
              </p>
            </div>
            
            <div className="p-4 border rounded">
              <h4 className="font-semibold mb-2">Instructions</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Resize your browser window to test responsiveness</li>
                <li>• Check that device detection changes dynamically</li>
                <li>• Verify touch detection on touch devices</li>
                <li>• Observe grid layout changes at different breakpoints</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mobile-specific content */}
      {isMobile && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-700">Mobile-Only Content</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-blue-600">
              This card only appears on mobile devices. Perfect for mobile-specific features 
              like simplified navigation or touch-optimized interactions.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Touch-specific content */}
      {isTouch && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-700">Touch-Enabled Content</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-green-600">
              This content appears on touch-enabled devices and can be used to provide 
              touch-specific interactions and gestures.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Desktop-specific content */}
      {isDesktop && (
        <Card className="border-purple-200 bg-purple-50">
          <CardHeader>
            <CardTitle className="text-purple-700">Desktop-Only Content</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-purple-600">
              This card only appears on desktop devices. Great for advanced features 
              that require more screen real estate or mouse interactions.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}