// middleware/auth.js
const jwt = require("jsonwebtoken")

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || "8dc3dedd759ad952748d636dc415c5d73da49bb859d749ad3bb1b5e561a76215"
const API_KEY = process.env.API_KEY || "72b6950e2a7de8dd768072f328b2755e3447607e39851b17"

// Middleware pour vérifier le token JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    console.log("Erreur d'authentification: Token manquant")
    return res.status(401).json({ error: "Token d'authentification requis" })
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.log("Erreur d'authentification: Token invalide", err)
      return res.status(403).json({ error: "Token invalide ou expiré" })
    }

    // Vérifier que les données utilisateur nécessaires sont présentes
    if (!user.userId) {
      console.log("Erreur d'authentification: Données utilisateur manquantes dans le token")
      return res.status(403).json({ error: "Token invalide (données utilisateur manquantes)" })
    }

    console.log("Utilisateur authentifié:", user)
    req.user = user
    next()
  })
}

// Middleware pour vérifier la clé API
const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers["x-api-key"]

  if (!apiKey || apiKey !== API_KEY) {
    console.log("Erreur d'authentification: Clé API invalide")
    return res.status(401).json({ error: "Clé API invalide" })
  }

  next()
}

module.exports = {
  authenticateToken,
  authenticateApiKey,
}
