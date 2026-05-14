# 🔧 Configuration Backend & Déploiement PWA - UNILIFE

## 📋 Checklist Déploiement

### Production - Avant de publier

- [ ] **HTTPS configuré** (obligatoire pour PWA)
- [ ] Certificate SSL valide (Let's Encrypt gratuit)
- [ ] `manifest.json` serveur avec bons headers
- [ ] Service worker enregistré
- [ ] Icons 192x192 et 512x512 disponibles
- [ ] Tester sur real device (pas juste Desktop)
- [ ] Lighthouse audit Green
- [ ] Test offline fonctionne
- [ ] Authentication préservée après install

---

## 🌐 Configuration Serveur Backend

### Node.js / Express Configuration

#### 1. Headers HTTPS Essentiels

```javascript
// server.js ou app.js
const express = require('express');
const app = express();

// ===== MIDDLEWARE HTTPS =====
app.use((req, res, next) => {
    // Forcer HTTPS en production
    if (process.env.NODE_ENV === 'production') {
        if (req.header('x-forwarded-proto') !== 'https') {
            res.redirect(`https://${req.header('host')}${req.url}`);
        }
    }
    next();
});

// ===== HEADERS SÉCURITÉ =====
const helmet = require('helmet');
app.use(helmet());

app.use((req, res, next) => {
    // Headers pour PWA
    res.header('Service-Worker-Allowed', '/');
    res.header('Cache-Control', 'public, max-age=3600');
    next();
});
```

#### 2. Serveur les Fichiers Statiques

```javascript
// ===== SERVEUR FICHIERS STATIQUES =====
app.use(express.static('path/to/unilife-front-end', {
    // Options pour le caching intelligent
    maxAge: '1d',
    etag: false,
    setHeaders: function(res, path) {
        // Manifest et Service Worker: pas de cache
        if (path.endsWith('manifest.json') || path.endsWith('service-worker.js')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
        
        // Index: court cache
        if (path.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
        
        // Assets: long cache (JS, CSS)
        if (path.match(/\.(js|css)$/)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
    }
}));

// ===== ROUTE PWA =====
app.get('/app', (req, res) => {
    // Rediriger vers index.html
    res.sendFile('./path/to/unilife-front-end/index.html');
});

app.get('/app/*', (req, res) => {
    // Toutes les routes PWA vont vers index.html (SPA routing)
    res.sendFile('./path/to/unilife-front-end/index.html');
});
```

#### 3. Compression et Performance

```javascript
const compression = require('compression');
app.use(compression());

// ===== CORS POUR PWA =====
const cors = require('cors');
app.use(cors({
    origin: [
        'http://localhost:3002',
        'http://localhost:3000',
        'https://yourdomain.com'  // Production
    ],
    credentials: true
}));
```

---

## 🔐 SSL/HTTPS Configuration

### Option 1: Let's Encrypt (Gratuit)

#### Sur VPS / Serveur Dédié:

```bash
# Installer Certbot
sudo apt-get install certbot python3-certbot-nginx

# Générer certificat
sudo certbot certonly --standalone -d yourdomain.com

# Certificat dans: /etc/letsencrypt/live/yourdomain.com/
# - fullchain.pem (certificat public)
# - privkey.pem (clé privée)

# Auto-renouvellement
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

#### Configuration Node.js:

```javascript
const https = require('https');
const fs = require('fs');

const options = {
    key: fs.readFileSync('/etc/letsencrypt/live/yourdomain.com/privkey.pem'),
    cert: fs.readFileSync('/etc/letsencrypt/live/yourdomain.com/fullchain.pem')
};

https.createServer(options, app).listen(443, () => {
    console.log('HTTPS server running on port 443');
});
```

### Option 2: Nginx Reverse Proxy

```nginx
# /etc/nginx/sites-available/unilife

upstream backend {
    server localhost:3002;
}

server {
    listen 80;
    server_name yourdomain.com;
    
    # Redirection vers HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    # Certificat SSL
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # Configuration SSL sécurisée
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
    ssl_prefer_server_ciphers on;
    
    # Headers de sécurité
    add_header Strict-Transport-Security \"max-age=31536000; includeSubDomains\" always;
    add_header X-Content-Type-Options \"nosniff\" always;
    add_header X-Frame-Options \"DENY\" always;
    
    # Headers PWA
    add_header Service-Worker-Allowed \"/\" always;
    
    location / {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 📁 Structure Fichiers Frontend

```
unilife-front-end/
├── index.html                    (Page principale PWA)
├── login.html
├── register.html
├── dashboard.js                  (Code PWA avec initPWA())
├── auth.js
├── style.css                     (Styles + bouton PWA)
├── manifest.json                 (Config PWA)
├── service-worker.js             (Caching strategy)
├── logo.png.png                  (192x192 minimum)
├── PWA-INSTALLATION-GUIDE.md     (User guide)
├── TECHNICAL-PWA-SPEC.md         (Dev spec)
└── DEPLOYMENT-GUIDE.md           (Ce fichier)
```

---

## 🧪 Test de Déploiement

### Test Local d'Abord

```bash
# Terminal 1: Backend
cd unilife-backend
npm start
# Serveur sur http://localhost:3002

# Terminal 2: (Optionnel) Serveur HTTPS simple
cd unilife-front-end
npx http-server --ssl -c-1
# Serveur sur https://localhost:8080
```

### Vérifications PWA

1. **Ouvrir DevTools (F12)**
   ```
   Application → Manifest
   - Doit afficher tous les champs
   - Icons 192x192 + 512x512 visibles
   
   Application → Service Workers
   - Status: \"active and running\"
   ```

2. **Tester le prompt**
   ```
   Console
   - \"PWA disponible pour installation\"
   - Ou: Erreurs d'événement
   ```

3. **Tester offline**
   ```
   Network tab → Offline checkbox ✓
   - Rafraîchir la page
   - Application fonctionne?
   ```

### Lighthouse Audit

```
DevTools → Lighthouse → PWA checkbox ✓ → Analyze

Résultat attendu:
✅ Installable
✅ PWA Optimized
✅ Service Worker
✅ Manifest valid
✅ HTTPS
```

---

## 📱 Test sur Appareil Réel

### Android avec Chrome

1. **Accéder à l'app via HTTPS**
   ```
   https://yourdomain.com/app
   
   OU en local:
   https://[IP-PC]:3002/app
   # Exemple: https://192.168.1.100:3002/app
   ```

2. **Attendre le bouton**
   - 2-3 secondes après chargement
   - \"Installer l'application\" dans le header

3. **Cliquer → Confirmer**
   - Prompt d'installation s'affiche
   - Confirmer → App sur écran d'accueil

### iOS avec Safari

1. **Ouvrir en Safari**
   ```
   https://yourdomain.com/app
   ```

2. **Menu Partagé (Share)**
   - Bouton bas-centre avec flèche
   - \"Ajouter à l'écran d'accueil\"

3. **Nommer l'app**
   - Garder \"UNILIFE\" ou changer
   - Ajouter → Créée

---

## 🚀 Déploiement Production

### Checklist Finale

```javascript
// ANTES DE PUBLIER:

1. ✅ Code Review
   - Pas de logs de debug
   - HTTPS forcé
   - CORS configuré

2. ✅ Performance
   - Lighthouse > 90
   - Temps chargement < 3s
   - Taille bundle < 500KB

3. ✅ Sécurité
   - HTTPS + SSL
   - Headers de sécurité
   - Token JWT valide
   - CORS restrictif

4. ✅ Testing
   - Offline fonctionne
   - Installation réussie
   - Desktop + Mobile
   - Authentification persistée

5. ✅ Monitoring
   - Logs d'erreur configurés
   - Uptime monitoring
   - User feedback collected
```

### Déploiement sur Heroku

```bash
# 1. Setup Git
git init
git add .
git commit -m \"PWA deployment ready\"

# 2. Login Heroku
heroku login

# 3. Create app
heroku create unilife-app

# 4. Configure variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your_secret_key

# 5. Deploy
git push heroku main

# 6. Vérifier les logs
heroku logs --tail

# Note: Heroku fournit HTTPS automatiquement ✅
```

### Déploiement sur Vercel (Frontend seulement)

```bash
# Vercel fournit HTTPS + CDN global

npm install -g vercel
vercel --prod

# Configure dans vercel.json:
# {
#   \"headers\": [
#     {
#       \"source\": \"/service-worker.js\",
#       \"headers\": [
#         { \"key\": \"Cache-Control\", \"value\": \"public, max-age=0, must-revalidate\" }
#       ]
#     },
#     {
#       \"source\": \"/manifest.json\",
#       \"headers\": [
#         { \"key\": \"Cache-Control\", \"value\": \"public, max-age=0, must-revalidate\" }
#       ]
#     }
#   ]
# }
```

---

## 📊 Monitoring et Logs

### Logs à Monitorer

```javascript
// server.js
const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ]
});

// Logs PWA
app.use((req, res, next) => {
    if (req.url.includes('manifest') || req.url.includes('service-worker')) {
        logger.info(`PWA resource requested: ${req.url}`);
    }
    next();
});

// Logs d'erreur
app.use((err, req, res, next) => {
    logger.error('Error:', err);
    res.status(500).send('Internal Server Error');
});
```

### Alertes Important

```javascript
// Monitorer:
1. Erreurs 500 (API issues)
2. 404 sur manifest.json ou service-worker.js
3. HTTPS downtime
4. Temps de réponse > 2s
5. SW registration failures
```

---

## 🔄 Mise à Jour Continu

### CI/CD Pipeline Example (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy PWA

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node
        uses: actions/setup-node@v2
        with:
          node-version: '16'
      
      - name: Install dependencies
        run: npm install
      
      - name: Run tests
        run: npm test
      
      - name: Lighthouse audit
        run: npm run lighthouse
      
      - name: Deploy to Heroku
        uses: akhileshns/heroku-deploy@v3.12.12
        with:
          heroku_api_key: ${{secrets.HEROKU_API_KEY}}
          heroku_app_name: unilife-app
          heroku_email: ${{secrets.HEROKU_EMAIL}}
```

---

## 🐛 Troubleshooting Déploiement

### Problème: \"PWA not installable\"

**Causes possibles:**
1. Pas de HTTPS
2. manifest.json malformé
3. Icons manquantes
4. Service Worker non enregistré

**Solution:**
```bash
# Vérifier manifest
curl https://yourdomain.com/manifest.json

# Vérifier headers
curl -I https://yourdomain.com/service-worker.js

# Lighthouse audit
lighthouse https://yourdomain.com --view
```

### Problème: \"Service Worker not registering\"

```javascript
// Vérifier console erreurs
navigator.serviceWorker.register('service-worker.js')
  .then(reg => console.log('✅', reg))
  .catch(err => console.error('❌', err));

// Erreurs courantes:
// - HTTPS not enforced
// - Scope mismatch
// - Manifest.json 404
```

### Problème: \"Cache not working offline\"

1. Vérifier files sont cachés:
   ```
   DevTools → Cache Storage → unilife-v2
   ```

2. Service Worker state:
   ```
   DevTools → Service Workers → Activated?
   ```

3. Forcer l'activation:
   ```javascript
   // Dans service-worker.js
   self.skipWaiting();
   self.clients.claim();
   ```

---

## 📈 Performance Metrics

### Cibles de Performance

| Métrique | Cible | Actuel |
|----------|-------|--------|
| Time to First Byte | < 1s | - |
| First Contentful Paint | < 1.8s | - |
| Largest Contentful Paint | < 2.5s | - |
| Cumulative Layout Shift | < 0.1 | - |
| First Input Delay | < 100ms | - |

### Optimisations à Considérer

```javascript
// 1. Compression Brotli
const compression = require('compression');
app.use(compression({ level: 11 })); // Brotli

// 2. CDN + Caching agressif
// CloudFlare, AWS CloudFront, etc.

// 3. Code splitting
// Charger JS à la demande

// 4. Image optimization
// WebP format, lazy loading
```

---

## 📚 Ressources Déploiement

- [Web.dev - Deployment](https://web.dev/lighthouse/)
- [MDN - Deploying PWA](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Installing)
- [Google - PWA Checklist](https://developers.google.com/web/progressive-web-apps/checklist)
- [Heroku Documentation](https://devcenter.heroku.com/)

---

## Résumé

✅ **HTTPS:** Obligatoire (Let's Encrypt gratuit)  
✅ **Headers:** Service-Worker-Allowed + Cache-Control  
✅ **Manifest:** Accessible sans cache  
✅ **Service Worker:** no-cache policy  
✅ **Testing:** DevTools + Lighthouse + Real Device  
✅ **Monitoring:** Logs + Alertes  
✅ **CI/CD:** Auto-deploy avec tests  

---

**Créé:** Mai 2026  
**Version:** Production Ready v1.0
