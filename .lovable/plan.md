

# Update Project Metadata and Author Information

## Overview
Update all project metadata files to reflect Albano Rocha as the author and set proper descriptions for GuardIAns across HTML metatags, package.json, and README.

## Changes

### 1. `index.html` - Site Metatags
- Remove TODO comments
- Update `meta description` to: "Meet GuardIAns, the voice-first AI that proactively calls seniors for daily medication reminders and wellness monitoring."
- Update `meta author` to: "Albano Rocha"
- Update `og:description` and `twitter:description` with the same description
- Update `twitter:site` to remove `@Lovable`
- Keep existing og:image and twitter:image as-is

### 2. `package.json` - Project Metadata
- Change `name` from `vite_react_shadcn_ts` to `guardians`
- Add `author` field: `"author": "Albano Rocha <albanorocha@gmail.com>"`
- Add `description` field with the project description

### 3. `README.md` - Full Rewrite
Replace the generic Lovable template with a proper project README containing:
- Project name and description
- Key features (voice-first AI, medication reminders, wellness monitoring)
- Tech stack listing
- Author and contact information (Albano Rocha, albanorocha@gmail.com)

## Technical Details

### index.html changes
```html
<title>GuardIAns</title>
<meta name="description" content="Meet GuardIAns, the voice-first AI that proactively calls seniors for daily medication reminders and wellness monitoring.">
<meta name="author" content="Albano Rocha" />
<meta property="og:description" content="Meet GuardIAns, the voice-first AI that proactively calls seniors for daily medication reminders and wellness monitoring.">
<meta name="twitter:description" content="Meet GuardIAns, the voice-first AI that proactively calls seniors for daily medication reminders and wellness monitoring.">
```

### package.json additions
```json
"name": "guardians",
"description": "Voice-first AI that proactively calls seniors for daily medication reminders and wellness monitoring.",
"author": "Albano Rocha <albanorocha@gmail.com>",
```

### README.md structure
- Project title and tagline
- Features list
- Tech stack
- Getting started instructions
- Author section with email

