import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

// Admin endpoint to remove users - should be protected in production
export async function DELETE(request: NextRequest) {
  try {
    // Check if user is authenticated and has admin privileges
    const session = await getServerSession(authOptions)
    
    // In a real app, you'd check for admin role here
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')
    
    if (!email) {
      return NextResponse.json({ error: 'Email parameter required' }, { status: 400 })
    }

    console.log(`Attempting to remove user: ${email}`)

    // Find the user first
    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      return NextResponse.json({ 
        error: 'User not found' 
      }, { status: 404 })
    }

    // Remove user from database (cascade delete will remove related records)
    await prisma.user.delete({
      where: { email }
    })

    console.log('User removed successfully:', user.id)
    
    return NextResponse.json({ 
      success: true,
      message: `User ${email} removed successfully`,
      data: { id: user.id, email: user.email }
    })

  } catch (error) {
    console.error('Admin remove user error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}