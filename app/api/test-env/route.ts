import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    data: {
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL_exists: !!process.env.DATABASE_URL,
      DATABASE_URL_preview: process.env.DATABASE_URL?.substring(0, 50) + '...',
      SUPABASE_URL_exists: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_URL_preview: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 50) + '...'
    }
  })
}