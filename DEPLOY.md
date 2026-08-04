# Deploying to GitHub Pages

This project is set up for automatic deployment to GitHub Pages via a GitHub Actions workflow. Once configured, every push to `main` rebuilds and re-deploys the app to the same URL.

## One-time setup (~5 minutes)

### 1. Create a GitHub repository
- Go to https://github.com/new
- Name: `gym-tracker` (or whatever you like)
- **Public** repo (required for free GitHub Pages)
- **Don't** initialize with README / .gitignore / license — we already have them
- Click **Create repository**

### 2. Add your Supabase keys as repo secrets
- In your new repo, go to **Settings** → **Secrets and variables** → **Actions**
- Click **New repository secret** for each of these:
  - `NEXT_PUBLIC_SUPABASE_URL` = `https://yysvzohrzuibemesytme.supabase.co`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the long JWT starting with `eyJ...`
- Also click the **Variables** tab → **New repository variable**:
  - `BASE_PATH` = `/gym-tracker` (or empty if you used a different repo name)

### 3. Push the project to GitHub
Open PowerShell in the project folder and run:

```powershell
cd "C:\Users\yenli\Gym Tracker App"
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/gym-tracker.git
git push -u origin main
```

(Use your actual GitHub username and the repo name you chose.)

### 4. Enable GitHub Pages
- In your repo, go to **Settings** → **Pages**
- Under **Source**, select **GitHub Actions**
- The workflow will start automatically. Watch the **Actions** tab to see it run.

### 5. Get your URL
- Once deployed, your app is at: `https://<your-username>.github.io/gym-tracker/`
- **Bookmark this URL.** It's stable forever.
- Install as a PWA once from this URL — all future updates appear automatically.

## Updating the app

After this one-time setup, every code change is just:

```powershell
cd "C:\Users\yenli\Gym Tracker App"
git add .
git commit -m "your change"
git push
```

GitHub Actions builds and deploys. Your phone's PWA picks up the update on next open. No new URLs, no re-installing, no re-signing in.

## Custom domain (optional)

If you have a domain (e.g. `gym.example.com`):
1. Repo → Settings → Pages → **Custom domain** → enter your domain
2. Add the DNS records GitHub shows you
3. Set `BASE_PATH` to empty in repo variables
4. Enforce HTTPS in Pages settings

## Troubleshooting

- **Workflow fails on build:** check the Actions log. Usually missing env vars.
- **App loads but no data:** check that both Supabase secrets are set correctly.
- **404 on direct URL hits:** GitHub Pages serves `out/index.html` correctly, but if you ever have a problem, check that the workflow uploaded the `out/` directory.
