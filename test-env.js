// Test environment loading
console.log('=== Environment Variables Test ===')
console.log('NODE_ENV:', process.env.NODE_ENV)
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL)
console.log('DATABASE_URL preview:', process.env.DATABASE_URL?.substring(0, 50) + '...')
console.log('SUPABASE_URL exists:', !!process.env.NEXT_PUBLIC_SUPABASE_URL)
console.log('SUPABASE_URL preview:', process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 50) + '...')

// Try to manually load .env
console.log('\n=== Manual .env loading ===')
require('dotenv').config()
console.log('After manual loading:')
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL)
console.log('DATABASE_URL preview:', process.env.DATABASE_URL?.substring(0, 50) + '...')