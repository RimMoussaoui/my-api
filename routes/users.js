// routes/users.js
const express = require("express")
const router = express.Router()
const { getDatabase } = require("../db/init")
const { authenticateToken, authenticateApiKey } = require("../middleware/auth")
const jwt = require("jsonwebtoken")

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || "8dc3dedd759ad952748d636dc415c5d73da49bb859d749ad3bb1b5e561a76215"
const TOKEN_EXPIRY = "7d" // 7 jours

// Route pour créer un utilisateur (accessible avec API key)
router.post("/", authenticateApiKey, async (req, res) => {
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

    // Créer un token JWT
    const token = jwt.sign({ userId: newUser._id, email: newUser.email }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY })

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

// Route pour rechercher des utilisateurs par nom ou email (pour ajouter des membres)
router.get("/search", authenticateToken, async (req, res) => {
  try {
    const { query } = req.query
    const userId = req.user.userId

    if (!query || query.length < 3) {
      return res.status(400).json({ error: "La requête de recherche doit contenir au moins 3 caractères" })
    }

    const db = await getDatabase()

    // Rechercher les utilisateurs par nom ou email
    const result = await db.find({
      selector: {
        type: "user",
        $or: [{ name: { $regex: `(?i)${query}` } }, { email: { $regex: `(?i)${query}` } }],
      },
      limit: 10,
      fields: ["_id", "name", "email", "type"],
    })

    // Filtrer l'utilisateur actuel de la liste
    const filteredUsers = result.docs.filter((user) => user._id !== userId)

    res.json(filteredUsers)
  } catch (error) {
    console.error("Erreur lors de la recherche d'utilisateurs:", error)
    res.status(500).json({ error: "Erreur lors de la recherche d'utilisateurs" })
  }
})

// Route pour récupérer le profil de l'utilisateur connecté
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId
    const db = await getDatabase()

    const user = await db.get(userId)

    // Exclure le mot de passe
    const { password, ...userWithoutPassword } = user

    res.json(userWithoutPassword)
  } catch (error) {
    console.error("Erreur lors de la récupération du profil:", error)
    res.status(500).json({ error: "Erreur lors de la récupération du profil" })
  }
})

// Ajouter cette route pour la compatibilité avec le frontend
router.get("/profile", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId
    const db = await getDatabase()

    const user = await db.get(userId)

    // Exclure le mot de passe
    const { password, ...userWithoutPassword } = user

    res.json(userWithoutPassword)
  } catch (error) {
    console.error("Erreur lors de la récupération du profil:", error)
    res.status(500).json({ error: "Erreur lors de la récupération du profil" })
  }
})

// Ajouter cette route pour mettre à jour le profil utilisateur
router.put("/profile", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId
    const { name, email, phone, profileImage } = req.body
    
    const db = await getDatabase()
    
    // Récupérer l'utilisateur actuel
    const currentUser = await db.get(userId)
    
    // Mettre à jour les champs
    const updatedUser = {
      ...currentUser,
      name: name || currentUser.name,
      email: email || currentUser.email,
      phone: phone || currentUser.phone,
      profileImage: profileImage || currentUser.profileImage,
      updatedAt: new Date().toISOString()
    }
    
    // Enregistrer les modifications
    const response = await db.insert(updatedUser)
    
    if (!response.ok) {
      throw new Error("Erreur lors de la mise à jour du profil")
    }
    
    // Exclure le mot de passe
    const { password, ...userWithoutPassword } = updatedUser
    
    res.json(userWithoutPassword)
  } catch (error) {
    console.error("Erreur lors de la mise à jour du profil:", error)
    res.status(500).json({ error: "Erreur lors de la mise à jour du profil" })
  }
})

module.exports = router