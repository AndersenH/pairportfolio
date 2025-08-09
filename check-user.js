const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function checkUser() {
  try {
    // The Supabase user ID from our earlier test
    const supabaseUserId = '8863f3d7-46c8-4c7e-acee-66598c7fa8f3'
    
    console.log('Checking for user with ID:', supabaseUserId)
    
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: supabaseUserId }
    })
    
    if (user) {
      console.log('User found in database:', user)
    } else {
      console.log('User NOT found in database')
      console.log('\nCreating user in database...')
      
      // Create the user
      const newUser = await prisma.user.create({
        data: {
          id: supabaseUserId,
          email: 'halldorandersen@gmail.com',
          name: 'Halldor Andersen'
        }
      })
      
      console.log('User created:', newUser)
    }
    
    // List all users
    console.log('\nAll users in database:')
    const allUsers = await prisma.user.findMany()
    allUsers.forEach(u => {
      console.log(`- ${u.email} (${u.id})`)
    })
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkUser()