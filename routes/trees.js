// routes/trees.js
const express = require("express")
const router = express.Router()
const { getDatabase } = require("../db/init")
const { authenticateToken } = require("../middleware/auth")

// Middleware d'authentification pour toutes les routes d'arbres
router.use(authenticateToken)

// Créer un nouvel arbre
router.post("/", async (req, res) => {
  try {
    const { name, species, description, height, diameter, health, projectId, location, images } = req.body
    const userId = req.user.userId
    const db = await getDatabase()

    if (!projectId) {
      return res.status(400).json({ error: "L'identifiant du projet est requis" })
    }

    if (!location || !location.latitude || !location.longitude) {
      return res.status(400).json({ error: "La localisation de l'arbre est requise" })
    }

    // Vérifier si le projet existe et si l'utilisateur est membre
    try {
      const project = await db.get(projectId)
      if (!project.members.includes(userId)) {
        return res.status(403).json({ error: "Vous n'êtes pas membre de ce projet" })
      }
    } catch (error) {
      return res.status(404).json({ error: "Projet non trouvé" })
    }

    // Créer un nouvel arbre
    const newTree = {
      _id: `tree:${Date.now()}`,
      type: "tree",
      name: name || "Arbre sans nom",
      species: species || "Espèce inconnue",
      description: description || "",
      height: height || null,
      diameter: diameter || null,
      health: health || "unknown",
      projectId,
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        name: location.name || "Position marquée",
      },
      images: images || [],
      createdBy: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // Enregistrer l'arbre dans la base de données
    const response = await db.insert(newTree)

    if (!response.ok) {
      throw new Error("Erreur lors de la création de l'arbre")
    }

    res.status(201).json(newTree)
  } catch (error) {
    console.error("Erreur lors de la création de l'arbre:", error)
    res.status(500).json({ error: "Erreur lors de la création de l'arbre" })
  }
})

// Récupérer un arbre spécifique
router.get("/:id", async (req, res) => {
  try {
    const treeId = req.params.id
    const userId = req.user.userId
    const db = await getDatabase()

    // Récupérer l'arbre
    const tree = await db.get(treeId)

    // Vérifier si l'arbre appartient à un projet
    if (!tree.projectId) {
      return res.status(400).json({ error: "Cet arbre n'est associé à aucun projet" })
    }

    // Vérifier si l'utilisateur est membre du projet
    const project = await db.get(tree.projectId)
    if (!project.members.includes(userId)) {
      return res.status(403).json({ error: "Accès non autorisé à cet arbre" })
    }

    res.json(tree)
  } catch (error) {
    console.error("Erreur lors de la récupération de l'arbre:", error)
    if (error.statusCode === 404) {
      res.status(404).json({ error: "Arbre non trouvé" })
    } else {
      res.status(500).json({ error: "Erreur lors de la récupération de l'arbre" })
    }
  }
})

// Mettre à jour un arbre
router.put("/:id", async (req, res) => {
  try {
    const treeId = req.params.id
    const userId = req.user.userId
    const { name, species, description, height, diameter, health, location, images } = req.body
    const db = await getDatabase()

    // Récupérer l'arbre existant
    const tree = await db.get(treeId)

    // Vérifier si l'utilisateur est membre du projet
    const project = await db.get(tree.projectId)
    if (!project.members.includes(userId)) {
      return res.status(403).json({ error: "Accès non autorisé à cet arbre" })
    }

    // Vérifier la taille des données
    const requestSize = JSON.stringify(req.body).length
    const maxSize = 10 * 1024 * 1024 // 10 MB

    if (requestSize > maxSize) {
      return res.status(413).json({ error: "Taille de la requête trop grande. Veuillez réduire la taille des images." })
    }

    // Mettre à jour les champs de l'arbre
    const updatedTree = {
      ...tree,
      name: name !== undefined ? name : tree.name,
      species: species !== undefined ? species : tree.species,
      description: description !== undefined ? description : tree.description,
      height: height !== undefined ? height : tree.height,
      diameter: diameter !== undefined ? diameter : tree.diameter,
      health: health !== undefined ? health : tree.health,
      location: location !== undefined ? location : tree.location,
      images: images !== undefined ? images : tree.images,
      updatedAt: new Date().toISOString(),
      updatedBy: userId,
    }

    // Enregistrer les modifications
    const response = await db.insert(updatedTree)

    if (!response.ok) {
      throw new Error("Erreur lors de la mise à jour de l'arbre")
    }

    res.json(updatedTree)
  } catch (error) {
    console.error("Erreur lors de la mise à jour de l'arbre:", error)
    if (error.statusCode === 404) {
      res.status(404).json({ error: "Arbre non trouvé" })
    } else {
      res.status(500).json({ error: "Erreur lors de la mise à jour de l'arbre" })
    }
  }
})

// Supprimer un arbre
router.delete("/:id", async (req, res) => {
  try {
    const treeId = req.params.id
    const userId = req.user.userId
    const db = await getDatabase()

    // Récupérer l'arbre existant
    const tree = await db.get(treeId)

    // Vérifier si l'utilisateur est membre du projet
    const project = await db.get(tree.projectId)
    if (!project.members.includes(userId)) {
      return res.status(403).json({ error: "Accès non autorisé à cet arbre" })
    }

    // Vérifier si l'utilisateur est le propriétaire du projet ou le créateur de l'arbre
    if (project.owner !== userId && tree.createdBy !== userId) {
      return res
        .status(403)
        .json({ error: "Seul le propriétaire du projet ou le créateur de l'arbre peut le supprimer" })
    }

    // Supprimer l'arbre
    const response = await db.destroy(tree._id, tree._rev)

    if (!response.ok) {
      throw new Error("Erreur lors de la suppression de l'arbre")
    }

    res.status(204).send()
  } catch (error) {
    console.error("Erreur lors de la suppression de l'arbre:", error)
    if (error.statusCode === 404) {
      res.status(404).json({ error: "Arbre non trouvé" })
    } else {
      res.status(500).json({ error: "Erreur lors de la suppression de l'arbre" })
    }
  }
})

// ==================== ROUTES D'HISTORIQUE ====================

// Ajouter un historique à un arbre
router.post("/:id/history", async (req, res) => {
  try {
    const treeId = req.params.id
    const userId = req.user.userId
    const { date, height, diameter, health, notes, oliveQuantity, oilQuantity, images, observations } = req.body
    const db = await getDatabase()

    // Récupérer l'arbre existant
    const tree = await db.get(treeId)

    // Vérifier si l'utilisateur est membre du projet
    const project = await db.get(tree.projectId)
    if (!project.members.includes(userId)) {
      return res.status(403).json({ error: "Accès non autorisé à cet arbre" })
    }

    // Créer l'entrée d'historique
    const historyEntry = {
      _id: `history:${treeId}:${Date.now()}`,
      type: "history",
      treeId: treeId,
      date: date || new Date().toISOString(),
      height: height || null,
      diameter: diameter || null,
      health: health || null,
      notes: notes || null,
      oliveQuantity: oliveQuantity || null,
      oilQuantity: oilQuantity || null,
      images: images || [],
      observations: observations || [],
      recordedBy: userId,
      recordedAt: new Date().toISOString(),
    }

    // Enregistrer l'historique dans la base de données
    const response = await db.insert(historyEntry)

    if (!response.ok) {
      throw new Error("Erreur lors de la création de l'historique")
    }

    res.status(201).json(historyEntry)
  } catch (error) {
    console.error("Erreur lors de la création de l'historique:", error)
    if (error.statusCode === 404) {
      res.status(404).json({ error: "Arbre non trouvé" })
    } else {
      res.status(500).json({ error: "Erreur lors de la création de l'historique" })
    }
  }
})

// Récupérer l'historique d'un arbre
router.get("/:id/history", async (req, res) => {
  try {
    const treeId = req.params.id
    const userId = req.user.userId
    const { year } = req.query
    const db = await getDatabase()

    // Récupérer l'arbre existant
    const tree = await db.get(treeId)

    // Vérifier si l'utilisateur est membre du projet
    const project = await db.get(tree.projectId)
    if (!project.members.includes(userId)) {
      return res.status(403).json({ error: "Accès non autorisé à cet arbre" })
    }

    // Construire la requête pour récupérer l'historique
    const selector = {
      type: "history",
      treeId: treeId,
    }

    // Filtrer par année si spécifiée
    if (year) {
      const startDate = `${year}-01-01T00:00:00.000Z`
      const endDate = `${year}-12-31T23:59:59.999Z`
      selector.date = {
        $gte: startDate,
        $lte: endDate,
      }
    }

    // Récupérer l'historique
    const result = await db.find({
      selector: selector,
      sort: [{ date: "desc" }],
    })

    // Organiser par année
    const historyByYear = {}
    result.docs.forEach((entry) => {
      const entryYear = new Date(entry.date).getFullYear().toString()
      if (!historyByYear[entryYear]) {
        historyByYear[entryYear] = []
      }
      historyByYear[entryYear].push(entry)
    })

    res.json(historyByYear)
  } catch (error) {
    console.error("Erreur lors de la récupération de l'historique:", error)
    if (error.statusCode === 404) {
      res.status(404).json({ error: "Arbre non trouvé" })
    } else {
      res.status(500).json({ error: "Erreur lors de la récupération de l'historique" })
    }
  }
})

// Mettre à jour une entrée d'historique
router.put("/:id/history/:historyId", async (req, res) => {
  try {
    const treeId = req.params.id
    const historyId = req.params.historyId
    const userId = req.user.userId
    const { date, height, diameter, health, notes, oliveQuantity, oilQuantity, images, observations } = req.body
    const db = await getDatabase()

    // Récupérer l'arbre existant
    const tree = await db.get(treeId)

    // Vérifier si l'utilisateur est membre du projet
    const project = await db.get(tree.projectId)
    if (!project.members.includes(userId)) {
      return res.status(403).json({ error: "Accès non autorisé à cet arbre" })
    }

    // Récupérer l'entrée d'historique existante
    const historyEntry = await db.get(historyId)

    // Vérifier que l'historique appartient bien à cet arbre
    if (historyEntry.treeId !== treeId) {
      return res.status(400).json({ error: "Cette entrée d'historique n'appartient pas à cet arbre" })
    }

    // Vérifier la taille des données
    const requestSize = JSON.stringify(req.body).length
    const maxSize = 10 * 1024 * 1024 // 10 MB

    if (requestSize > maxSize) {
      return res.status(413).json({ error: "Taille de la requête trop grande. Veuillez réduire la taille des images." })
    }

    // Mettre à jour l'entrée d'historique
    const updatedHistory = {
      ...historyEntry,
      date: date !== undefined ? date : historyEntry.date,
      height: height !== undefined ? height : historyEntry.height,
      diameter: diameter !== undefined ? diameter : historyEntry.diameter,
      health: health !== undefined ? health : historyEntry.health,
      notes: notes !== undefined ? notes : historyEntry.notes,
      oliveQuantity: oliveQuantity !== undefined ? oliveQuantity : historyEntry.oliveQuantity,
      oilQuantity: oilQuantity !== undefined ? oilQuantity : historyEntry.oilQuantity,
      images: images !== undefined ? images : historyEntry.images,
      observations: observations !== undefined ? observations : historyEntry.observations,
      updatedAt: new Date().toISOString(),
      updatedBy: userId,
    }

    // Enregistrer les modifications
    const response = await db.insert(updatedHistory)

    if (!response.ok) {
      throw new Error("Erreur lors de la mise à jour de l'historique")
    }

    res.json(updatedHistory)
  } catch (error) {
    console.error("Erreur lors de la mise à jour de l'historique:", error)
    if (error.statusCode === 404) {
      res.status(404).json({ error: "Entrée d'historique non trouvée" })
    } else {
      res.status(500).json({ error: "Erreur lors de la mise à jour de l'historique" })
    }
  }
})

// Supprimer une entrée d'historique
router.delete("/:id/history/:historyId", async (req, res) => {
  try {
    const treeId = req.params.id
    const historyId = req.params.historyId
    const userId = req.user.userId
    const db = await getDatabase()

    // Récupérer l'arbre existant
    const tree = await db.get(treeId)

    // Vérifier si l'utilisateur est membre du projet
    const project = await db.get(tree.projectId)
    if (!project.members.includes(userId)) {
      return res.status(403).json({ error: "Accès non autorisé à cet arbre" })
    }

    // Récupérer l'entrée d'historique existante
    const historyEntry = await db.get(historyId)

    // Vérifier que l'historique appartient bien à cet arbre
    if (historyEntry.treeId !== treeId) {
      return res.status(400).json({ error: "Cette entrée d'historique n'appartient pas à cet arbre" })
    }

    // Vérifier si l'utilisateur peut supprimer (propriétaire du projet ou créateur de l'entrée)
    if (project.owner !== userId && historyEntry.recordedBy !== userId) {
      return res.status(403).json({
        error: "Seul le propriétaire du projet ou le créateur de l'entrée peut la supprimer",
      })
    }

    // Supprimer l'entrée d'historique
    const response = await db.destroy(historyEntry._id, historyEntry._rev)

    if (!response.ok) {
      throw new Error("Erreur lors de la suppression de l'historique")
    }

    res.status(204).send()
  } catch (error) {
    console.error("Erreur lors de la suppression de l'historique:", error)
    if (error.statusCode === 404) {
      res.status(404).json({ error: "Entrée d'historique non trouvée" })
    } else {
      res.status(500).json({ error: "Erreur lors de la suppression de l'historique" })
    }
  }
})

module.exports = router
