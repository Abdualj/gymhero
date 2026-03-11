# Quick Testing Guide - Profile Features

## Test These Features Now:

### 1. Profile Picture Upload ✅
```
1. Go to https://gymhero-gh.netlify.app/
2. Login
3. Click "Edit Profile" button (top right)
4. Click camera icon on profile picture
5. Select an image (JPG, PNG, GIF, WEBP - max 5MB)
6. See preview immediately
7. Click "Save Changes"
8. Wait for success toast
9. See picture in profile header
```

### 2. Bio Update ✅
```
1. Click "Edit Profile"
2. Type in bio textarea (max 200 chars)
3. See character counter update
4. Click "Save Changes"
5. See bio appear under email in profile
```

### 3. Username Update ✅
```
1. Click "Edit Profile"
2. Change username
3. Click "Save Changes"
4. See new username in profile header
```

## Expected Behavior:

### ✅ Success Case:
- Profile editor modal opens smoothly
- Image preview shows selected file
- Save button shows "Saving..." during upload
- Green toast notification: "Profile updated successfully!"
- Modal closes automatically
- New picture/bio/username appears immediately
- Picture loads from Cloudinary (URL starts with https://res.cloudinary.com/)

### ❌ Error Cases to Watch:

**"Invalid or expired token"**
- Solution: Logout and login again

**"Failed to upload"**
- Check file size (must be under 5MB)
- Check file format (only images allowed)
- Check Railway logs for Cloudinary errors

**Picture doesn't appear**
- Check browser console for errors
- Verify Cloudinary credentials in Railway
- Check if STORAGE_MODE=cloudinary is set

## Railway Deployment Status:

✅ Code pushed to GitHub
✅ Railway auto-deploying (check Railway dashboard)
⏳ Wait 2-3 minutes for deployment to complete

## Check Railway Logs:

Look for these messages:
```
🔧 Cloudinary mode enabled for profile pictures
✅ Cloudinary configured for profiles
📸 Uploading profile picture to Cloudinary for user X
✅ Profile picture uploaded to Cloudinary: https://...
```

## API Endpoints Available:

1. **Update Profile Text:**
   ```
   PUT /api/auth/profile
   Body: { username: "new name", bio: "my bio" }
   Headers: { Authorization: "Bearer <token>" }
   ```

2. **Update Profile Picture:**
   ```
   POST /api/auth/profile/picture
   Body: FormData with 'profile_picture' file
   Headers: { Authorization: "Bearer <token>" }
   ```

3. **Get User Profile:**
   ```
   GET /api/auth/profile/:userId
   ```

## Troubleshooting:

### Can't see "Edit Profile" button?
- Make sure you're logged in
- Check UserProfile.tsx is deployed on Netlify
- Refresh the page

### Modal doesn't open?
- Check browser console for errors
- Verify ProfileEditor component is imported

### Upload succeeds but picture doesn't show?
- Check if URL is Cloudinary or local
- If local (/uploads/...), backend might not have STORAGE_MODE=cloudinary
- Check Railway environment variables

### Changes don't persist?
- Check network tab for API response
- Verify token is valid
- Check Railway logs for database errors

---

**Ready to test!** 🎉

The profile editing system is now:
- ✅ Fully integrated with Cloudinary
- ✅ Supports profile picture uploads
- ✅ Supports bio and username updates
- ✅ Has beautiful UI with toast notifications
- ✅ Deployed to Railway backend
- ✅ Connected to Netlify frontend
