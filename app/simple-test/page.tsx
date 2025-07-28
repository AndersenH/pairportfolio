'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useMobileResponsive } from '@/lib/client-utils'

export default function SimpleTestPage() {
  const [count, setCount] = useState(0)
  const { isMobile, isTablet, isDesktop, width } = useMobileResponsive()

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Simple App Test</h1>
      
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Basic Functionality Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>Counter: {count}</p>
            <Button onClick={() => setCount(count + 1)}>
              Increment
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mobile Responsive Test</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p>Screen width: {width}px</p>
              <p>Device type: {isMobile ? 'Mobile' : isTablet ? 'Tablet' : 'Desktop'}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                <div className="bg-blue-100 p-2 rounded">Col 1</div>
                <div className="bg-green-100 p-2 rounded">Col 2</div>
                <div className="bg-purple-100 p-2 rounded lg:block hidden">Col 3 (lg+)</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}