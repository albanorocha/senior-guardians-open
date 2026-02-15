

# My Profile Page and User Menu

## Overview
Replace the standalone Logout button in the navigation with a profile dropdown menu showing the user's avatar and name. Add a new "My Profile" page for editing user information and changing password.

## Changes

### 1. Database: Add `avatar_url` column to `profiles` table
Add a text column to store the URL of the user's profile photo. Also create a storage bucket for avatar uploads.

### 2. New Page: `src/pages/Profile.tsx`
A form page where users can:
- Upload/change profile photo (stored in a new `avatars` storage bucket)
- Edit full name, phone, and age
- Change password (using Supabase auth `updateUser`)

### 3. Update Navigation: `src/components/AppNav.tsx`
Replace the Logout button with a dropdown menu triggered by clicking on the user's avatar + name. The dropdown will contain:
- "My Profile" link (navigates to `/profile`)
- "Logout" action

The dropdown will use the existing `DropdownMenu` component from shadcn/ui.

### 4. Route: `src/App.tsx`
Add a new protected route: `/profile` pointing to the Profile page.

---

## Technical Details

### Database Migration
```sql
-- Add avatar_url to profiles
ALTER TABLE public.profiles ADD COLUMN avatar_url text;

-- Create avatars storage bucket (public)
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- RLS: anyone can view avatars
CREATE POLICY "Public read avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

-- RLS: authenticated users can upload their own avatar
CREATE POLICY "Users upload own avatar" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: users can update/delete their own avatar
CREATE POLICY "Users update own avatar" ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own avatar" ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
```

### Navigation Dropdown (AppNav.tsx)
- Fetch the user's profile (full_name, avatar_url) on mount
- Show Avatar component with fallback initials + user name
- DropdownMenu with "My Profile" and "Logout" items
- Remove the standalone Logout button

### Profile Page (Profile.tsx)
- Load current profile data on mount
- Avatar upload: upload to `avatars/{user_id}/avatar.png`, save public URL to `profiles.avatar_url`
- Form fields: Full Name, Phone, Age
- Password change section: New Password + Confirm Password
- Save button updates `profiles` table and optionally calls `supabase.auth.updateUser({ password })`

