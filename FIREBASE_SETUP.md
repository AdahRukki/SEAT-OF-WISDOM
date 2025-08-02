# Firebase Password Reset Setup Guide

## Why you're not receiving emails

The password reset emails won't work until you properly configure Firebase Authentication in your Firebase Console.

## Step-by-step setup:

### 1. Go to Firebase Console
- Visit https://console.firebase.google.com/
- Select your project (or create one if you haven't)

### 2. Enable Authentication
- In the left sidebar, click "Authentication"
- Click "Get started" if it's not already enabled

### 3. Enable Email/Password Sign-in
- Go to the "Sign-in method" tab
- Click on "Email/Password"
- Enable both toggles:
  - ✅ Email/Password
  - ✅ Email link (passwordless sign-in)
- Click "Save"

### 4. Add the user account
- Go to the "Users" tab in Authentication
- Click "Add user"
- Email: `adahrukki@gmail.com`
- Create a password (you can reset it later)
- Click "Add user"

### 5. Configure authorized domains
- Go to "Settings" → "Authorized domains"
- Your Replit domain should already be there
- If not, add: `your-repl-name.replit.dev`

### 6. Test the reset
- Go back to your login page
- Click "Forgot your password?"
- Enter `adahrukki@gmail.com`
- Check your Gmail inbox (and spam folder)

## Alternative: Use demo accounts for now

While setting up Firebase, you can use these working accounts:
- **School Admin:** admin1@seatofwisdom.edu / password123
- **Student:** john.doe@student.com / password123

## Troubleshooting

If still not working:
1. Check browser console for Firebase errors
2. Verify your Firebase project ID in secrets
3. Make sure the email exists in Firebase Users tab
4. Check Gmail spam folder