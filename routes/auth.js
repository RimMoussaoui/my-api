// routes/auth.js
const express = require("express")
const router = express.Router()
const jwt = require("jsonwebtoken")
const crypto = require("crypto")
const { getDatabase } = require("../db/init")

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || "8dc3dedd759ad952748d636dc415c5d73da49bb859d749ad3bb1b5e561a76215"
const TOKEN_EXPIRY = "7d" // 7 jours
const RESET_TOKEN_EXPIRY = 3600000 // 1 heure en millisecondes

// Route de connexion
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: "Email et mot de passe requis" })
    }

    const db = await getDatabase()

    // Rechercher l'utilisateur par email
    const result = await db.find({
      selector: {
        type: "user",
        email: email,
      },
    })

    if (!result.docs || result.docs.length === 0) {
      return res.status(401).json({ error: "Email ou mot de passe incorrect" })
    }

    const user = result.docs[0]

    // Dans une vraie application, vous devriez comparer les mots de passe hachés
    // Pour cette démo, nous comparons simplement les mots de passe en clair
    if (user.password !== password) {
      return res.status(401).json({ error: "Email ou mot de passe incorrect" })
    }

    // Créer un token JWT avec les informations nécessaires
    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        name: user.name,
      },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY },
    )

    // Retourner l'utilisateur sans le mot de passe et le token
    const { password: _, ...userWithoutPassword } = user

    res.json({
      user: userWithoutPassword,
      token,
    })
  } catch (error) {
    console.error("Erreur de connexion:", error)
    res.status(500).json({ error: "Erreur lors de la connexion" })
  }
})

// Route d'inscription
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Nom, email et mot de passe requis" })
    }

    const db = await getDatabase()

    // Vérifier si l'email existe déjà
    const result = await db.find({
      selector: {
        type: "user",
        email: email,
      },
    })

    if (result.docs && result.docs.length > 0) {
      return res.status(409).json({ error: "Un utilisateur avec cet email existe déjà" })
    }

    // Créer un nouvel utilisateur
    const newUser = {
      _id: `user:${Date.now()}`,
      type: "user",
      name,
      email,
      password, // Dans une vraie application, hachez le mot de passe
      createdAt: new Date().toISOString(),
    }

    // Enregistrer l'utilisateur dans la base de données
    const response = await db.insert(newUser)

    if (!response.ok) {
      throw new Error("Erreur lors de l'enregistrement de l'utilisateur")
    }

    // Créer un token JWT avec les informations nécessaires
    const token = jwt.sign(
      {
        userId: newUser._id,
        email: newUser.email,
        name: newUser.name,
      },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY },
    )

    // Retourner l'utilisateur sans le mot de passe et le token
    const { password: _, ...userWithoutPassword } = newUser

    res.status(201).json({
      user: userWithoutPassword,
      token,
    })
  } catch (error) {
    console.error("Erreur d'inscription:", error)
    res.status(500).json({ error: "Erreur lors de l'inscription" })
  }
})

// Route pour vérifier la validité d'un token
router.get("/verify", async (req, res) => {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    return res.status(401).json({ error: "Token d'authentification requis" })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    res.json({ valid: true, user: decoded })
  } catch (error) {
    res.status(403).json({ valid: false, error: "Token invalide ou expiré" })
  }
})

// Middleware pour vérifier l'authentification
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    return res.status(401).json({ error: "Token d'authentification requis" })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = decoded
    next()
  } catch (error) {
    return res.status(403).json({ error: "Token invalide ou expiré" })
  }
}

// Route pour changer le mot de passe
router.post("/change-password", authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    const userId = req.user.userId

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Mot de passe actuel et nouveau mot de passe requis" })
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Le nouveau mot de passe doit contenir au moins 6 caractères" })
    }

    const db = await getDatabase()

    // Récupérer l'utilisateur par ID
    const user = await db.get(userId)

    if (!user) {
      return res.status(404).json({ error: "Utilisateur non trouvé" })
    }

    // Vérifier le mot de passe actuel
    if (user.password !== currentPassword) {
      return res.status(401).json({ error: "Mot de passe actuel incorrect" })
    }

    // Mettre à jour le mot de passe
    user.password = newPassword
    user.updatedAt = new Date().toISOString()

    // Enregistrer les modifications
    await db.insert(user)

    res.json({ success: true, message: "Mot de passe modifié avec succès" })
  } catch (error) {
    console.error("Erreur lors du changement de mot de passe:", error)
    res.status(500).json({ error: "Erreur lors du changement de mot de passe" })
  }
})

// Route alternative pour changer le mot de passe (pour compatibilité)
router.post("/password", authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    const userId = req.user.userId

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Mot de passe actuel et nouveau mot de passe requis" })
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Le nouveau mot de passe doit contenir au moins 6 caractères" })
    }

    const db = await getDatabase()

    // Récupérer l'utilisateur par ID
    const user = await db.get(userId)

    if (!user) {
      return res.status(404).json({ error: "Utilisateur non trouvé" })
    }

    // Vérifier le mot de passe actuel
    if (user.password !== currentPassword) {
      return res.status(401).json({ error: "Mot de passe actuel incorrect" })
    }

    // Mettre à jour le mot de passe
    user.password = newPassword
    user.updatedAt = new Date().toISOString()

    // Enregistrer les modifications
    await db.insert(user)

    res.json({ success: true, message: "Mot de passe modifié avec succès" })
  } catch (error) {
    console.error("Erreur lors du changement de mot de passe:", error)
    res.status(500).json({ error: "Erreur lors du changement de mot de passe" })
  }
})

// Route pour demander une réinitialisation de mot de passe
// Retirer le middleware authenticateToken s'il était présent
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ error: "Email requis" })
    }

    const db = await getDatabase()

    // Rechercher l'utilisateur par email
    const result = await db.find({
      selector: {
        type: "user",
        email: email,
      },
    })

    if (!result.docs || result.docs.length === 0) {
      // Pour des raisons de sécurité, ne pas indiquer si l'email existe ou non
      return res.json({ success: true, message: "Si l'email existe, un lien de réinitialisation sera envoyé" })
    }

    const user = result.docs[0]

    // Générer un token de réinitialisation
    const resetToken = crypto.randomBytes(32).toString("hex")
    const resetTokenExpiry = Date.now() + RESET_TOKEN_EXPIRY

    // Mettre à jour l'utilisateur avec le token de réinitialisation
    user.resetToken = resetToken
    user.resetTokenExpiry = resetTokenExpiry
    user.updatedAt = new Date().toISOString()

    // Enregistrer les modifications
    await db.insert(user)

    // Dans une vraie application, envoyer un email avec le lien de réinitialisation
    // Pour cette démo, nous simulons l'envoi d'un email
    console.log(`
      ====== EMAIL DE RÉINITIALISATION DE MOT DE PASSE ======
      À: ${user.email}
      Sujet: Réinitialisation de votre mot de passe
      
      Bonjour ${user.name},
      
      Vous avez demandé une réinitialisation de votre mot de passe.
      Cliquez sur le lien ci-dessous pour réinitialiser votre mot de passe:
      
      http://votre-app.com/reset-password?token=${resetToken}
      
      Ce lien expirera dans 1 heure.
      
      Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
      
      Cordialement,
      L'équipe de votre application
    `)

    res.json({ success: true, message: "Un email de réinitialisation a été envoyé" })
  } catch (error) {
    console.error("Erreur lors de la demande de réinitialisation:", error)
    res.status(500).json({ error: "Erreur lors de la demande de réinitialisation" })
  }
})

// Route pour réinitialiser le mot de passe avec un token
// Retirer le middleware authenticateToken s'il était présent
router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body

    if (!token || !newPassword) {
      return res.status(400).json({ error: "Token et nouveau mot de passe requis" })
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Le nouveau mot de passe doit contenir au moins 6 caractères" })
    }

    const db = await getDatabase()

    // Rechercher l'utilisateur par token de réinitialisation
    const result = await db.find({
      selector: {
        type: "user",
        resetToken: token,
      },
    })

    if (!result.docs || result.docs.length === 0) {
      return res.status(400).json({ error: "Token de réinitialisation invalide" })
    }

    const user = result.docs[0]

    // Vérifier si le token a expiré
    if (!user.resetTokenExpiry || user.resetTokenExpiry < Date.now()) {
      return res.status(400).json({ error: "Token de réinitialisation expiré" })
    }

    // Mettre à jour le mot de passe et supprimer le token de réinitialisation
    user.password = newPassword
    user.resetToken = null
    user.resetTokenExpiry = null
    user.updatedAt = new Date().toISOString()

    // Enregistrer les modifications
    await db.insert(user)

    res.json({ success: true, message: "Mot de passe réinitialisé avec succès" })
  } catch (error) {
    console.error("Erreur lors de la réinitialisation du mot de passe:", error)
    res.status(500).json({ error: "Erreur lors de la réinitialisation du mot de passe" })
  }
})

module.exports = router
