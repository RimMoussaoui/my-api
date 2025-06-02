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
    const requestSize = JSON.stringify(req.body).length;
    const maxSize = 10 * 1024 * 1024; // 10 MB
    
    if (requestSize > maxSize) {
      return res.status(413).json({ error: "Taille de la requête trop grande. Veuillez réduire la taille des images." });
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

module.exports = router
