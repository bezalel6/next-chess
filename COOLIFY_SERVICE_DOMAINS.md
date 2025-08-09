# Coolify Service Domain Configuration for rndev.site

## How to Configure Your Custom Domains in Coolify

In Coolify, you have two options for each service:
1. **"Generate Domain"** button = Coolify provides an auto-generated subdomain (like `app-xyz.coolify.io`)
2. **Manual entry** = Type your own custom domain in the text field

## For Your Setup with rndev.site

### 1. Domains for App
**DON'T** click "Generate Domain"  
**DO** type directly in the input field:
```
chess.rndev.site
```

### 2. Domains for Kong (API Gateway)
**DON'T** click "Generate Domain"  
**DO** type directly in the input field:
```
chess-api.rndev.site
```

### 3. Other Services
Leave these empty - they don't need public access:
- **Auth**: Leave empty (accessed internally via Kong)
- **Realtime**: Leave empty (accessed internally via Kong)  
- **Storage**: Leave empty (accessed internally via Kong)
- **Mailhog**: Leave empty unless you want to debug emails

## DNS Records You Need

Add these A records where you manage rndev.site:

| Type | Name | Value |
|------|------|-------|
| A | chess | YOUR_SERVER_IP |
| A | chess-api | YOUR_SERVER_IP |

## Step-by-Step

1. **For App Service:**
   - Find the text field under "Domains for App"
   - Type: `chess.rndev.site`
   - Enable SSL certificate checkbox

2. **For Kong Service:**
   - Find the text field under "Domains for Kong"
   - Type: `chess-api.rndev.site`
   - Enable SSL certificate checkbox

3. **Save Configuration:**
   - Click "Save" button
   - Click "Deploy" or "Redeploy"

## Your Final URLs

- **Chess Game**: https://chess.rndev.site
- **API Gateway**: https://chess-api.rndev.site

## Common Mistakes to Avoid

❌ **DON'T** click "Generate Domain" - that creates Coolify subdomains  
❌ **DON'T** add domains for Auth, Realtime, Storage services  
✅ **DO** type your custom domains directly in the input fields  
✅ **DO** enable SSL certificates for both domains