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

    // Créer un nouvel arbre avec historique vide
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
      history: {}, // Historique vide au début
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
    const { year, includeHistory = "true" } = req.query
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

    // Filtrer l'historique si nécessaire
    const responseTree = { ...tree }

    if (includeHistory === "false") {
      // Exclure l'historique de la réponse
      delete responseTree.history
    } else if (year) {
      // Filtrer par année spécifique
      responseTree.history = tree.history && tree.history[year] ? { [year]: tree.history[year] } : {}
    }

    res.json(responseTree)
  } catch (error) {
    console.error("Erreur lors de la récupération de l'arbre:", error)
    if (error.statusCode === 404) {
      res.status(404).json({ error: "Arbre non trouvé" })
    } else {
      res.status(500).json({ error: "Erreur lors de la récupération de l'arbre" })
    }
  }
})

// Récupérer uniquement l'historique d'un arbre
router.get("/:id/history", async (req, res) => {
  try {
    const treeId = req.params.id
    const userId = req.user.userId
    const { year, limit = 100, offset = 0 } = req.query
    const db = await getDatabase()

    // Récupérer l'arbre
    const tree = await db.get(treeId)

    // Vérifier si l'utilisateur est membre du projet
    const project = await db.get(tree.projectId)
    if (!project.members.includes(userId)) {
      return res.status(403).json({ error: "Accès non autorisé à cet arbre" })
    }

    let history = tree.history || {}

    // Filtrer par année si spécifiée
    if (year) {
      history = history[year] ? { [year]: history[year] } : {}
    }

    // Appliquer la pagination si nécessaire
    if (limit || offset) {
      const paginatedHistory = {}
      Object.keys(history).forEach((yearKey) => {
        const yearEntries = history[yearKey] || []
        const startIndex = Number.parseInt(offset)
        const endIndex = startIndex + Number.parseInt(limit)
        paginatedHistory[yearKey] = yearEntries.slice(startIndex, endIndex)
      })
      history = paginatedHistory
    }

    res.json(history)
  } catch (error) {
    console.error("Erreur lors de la récupération de l'historique:", error)
    if (error.statusCode === 404) {
      res.status(404).json({ error: "Arbre non trouvé" })
    } else {
      res.status(500).json({ error: "Erreur lors de la récupération de l'historique" })
    }
  }
})

// Ajouter une entrée à l'historique
router.post("/:id/history", async (req, res) => {
  try {
    const treeId = req.params.id
    const userId = req.user.userId
    const { date, height, diameter, health, notes } = req.body
    const db = await getDatabase()

    // Validation des données
    if (!date) {
      return res.status(400).json({ error: "La date est requise" })
    }

    if (height !== null && height !== undefined && (isNaN(height) || height < 0)) {
      return res.status(400).json({ error: "La hauteur doit être un nombre positif" })
    }

    if (diameter !== null && diameter !== undefined && (isNaN(diameter) || diameter < 0)) {
      return res.status(400).json({ error: "Le diamètre doit être un nombre positif" })
    }

    // Récupérer l'arbre existant
    const tree = await db.get(treeId)

    // Vérifier si l'utilisateur est membre du projet
    const project = await db.get(tree.projectId)
    if (!project.members.includes(userId)) {
      return res.status(403).json({ error: "Accès non autorisé à cet arbre" })
    }

    // Préparer la nouvelle entrée d'historique
    const timestamp = Date.now()
    const entryDate = new Date(date)
    const year = entryDate.getFullYear().toString()

    const newHistoryEntry = {
      date: entryDate.toISOString(),
      height: height || null,
      diameter: diameter || null,
      health: health || null,
      notes: notes || null,
      timestamp,
      addedBy: userId,
      addedAt: new Date().toISOString(),
    }

    // Initialiser l'historique s'il n'existe pas
    if (!tree.history) {
      tree.history = {}
    }

    // Initialiser l'année s'elle n'existe pas
    if (!tree.history[year]) {
      tree.history[year] = []
    }

    // Vérifier les doublons (même timestamp ou date très proche)
    const existingEntry = tree.history[year].find((entry) => {
      const entryTime = new Date(entry.date).getTime()
      const newEntryTime = entryDate.getTime()
      return Math.abs(entryTime - newEntryTime) < 60000 || entry.timestamp === timestamp
    })

    if (existingEntry) {
      return res.status(409).json({ error: "Une entrée similaire existe déjà pour cette date" })
    }

    // Ajouter la nouvelle entrée
    tree.history[year].push(newHistoryEntry)

    // Trier les entrées par date (plus récent en premier)
    tree.history[year].sort((a, b) => new Date(b.date) - new Date(a.date))

    // Mettre à jour l'arbre
    tree.updatedAt = new Date().toISOString()
    tree.updatedBy = userId

    // Vérifier la taille du document
    const treeSize = JSON.stringify(tree).length
    const maxSize = 15 * 1024 * 1024 // 15 MB (limite CouchDB = 16MB)

    if (treeSize > maxSize) {
      return res.status(413).json({
        error: "L'historique de cet arbre est trop volumineux. Veuillez archiver les anciennes données.",
      })
    }

    // Enregistrer les modifications
    const response = await db.insert(tree)

    if (!response.ok) {
      throw new Error("Erreur lors de l'ajout de l'entrée d'historique")
    }

    res.status(201).json({
      message: "Entrée d'historique ajoutée avec succès",
      entry: newHistoryEntry,
      year: year,
    })
  } catch (error) {
    console.error("Erreur lors de l'ajout de l'entrée d'historique:", error)
    if (error.statusCode === 404) {
      res.status(404).json({ error: "Arbre non trouvé" })
    } else {
      res.status(500).json({ error: "Erreur lors de l'ajout de l'entrée d'historique" })
    }
  }
})

// Modifier une entrée d'historique
router.put("/:id/history/:year/:timestamp", async (req, res) => {
  try {
    const { id: treeId, year, timestamp } = req.params
    const userId = req.user.userId
    const { date, height, diameter, health, notes } = req.body
    const db = await getDatabase()

    // Récupérer l'arbre existant
    const tree = await db.get(treeId)

    // Vérifier si l'utilisateur est membre du projet
    const project = await db.get(tree.projectId)
    if (!project.members.includes(userId)) {
      return res.status(403).json({ error: "Accès non autorisé à cet arbre" })
    }

    // Vérifier que l'historique et l'année existent
    if (!tree.history || !tree.history[year]) {
      return res.status(404).json({ error: "Entrée d'historique non trouvée" })
    }

    // Trouver l'entrée à modifier
    const entryIndex = tree.history[year].findIndex((entry) => entry.timestamp === Number.parseInt(timestamp))

    if (entryIndex === -1) {
      return res.status(404).json({ error: "Entrée d'historique non trouvée" })
    }

    // Validation des nouvelles données
    if (height !== undefined && height !== null && (isNaN(height) || height < 0)) {
      return res.status(400).json({ error: "La hauteur doit être un nombre positif" })
    }

    if (diameter !== undefined && diameter !== null && (isNaN(diameter) || diameter < 0)) {
      return res.status(400).json({ error: "Le diamètre doit être un nombre positif" })
    }

    // Mettre à jour l'entrée
    const existingEntry = tree.history[year][entryIndex]
    const updatedEntry = {
      ...existingEntry,
      date: date ? new Date(date).toISOString() : existingEntry.date,
      height: height !== undefined ? height : existingEntry.height,
      diameter: diameter !== undefined ? diameter : existingEntry.diameter,
      health: health !== undefined ? health : existingEntry.health,
      notes: notes !== undefined ? notes : existingEntry.notes,
      updatedBy: userId,
      updatedAt: new Date().toISOString(),
    }

    tree.history[year][entryIndex] = updatedEntry

    // Si la date a changé, vérifier si on doit déplacer l'entrée vers une autre année
    if (date) {
      const newYear = new Date(date).getFullYear().toString()
      if (newYear !== year) {
        // Supprimer de l'ancienne année
        tree.history[year].splice(entryIndex, 1)

        // Ajouter à la nouvelle année
        if (!tree.history[newYear]) {
          tree.history[newYear] = []
        }
        tree.history[newYear].push(updatedEntry)
        tree.history[newYear].sort((a, b) => new Date(b.date) - new Date(a.date))

        // Nettoyer l'ancienne année si elle est vide
        if (tree.history[year].length === 0) {
          delete tree.history[year]
        }
      } else {
        // Retrier la même année
        tree.history[year].sort((a, b) => new Date(b.date) - new Date(a.date))
      }
    }

    // Mettre à jour l'arbre
    tree.updatedAt = new Date().toISOString()
    tree.updatedBy = userId

    // Enregistrer les modifications
    const response = await db.insert(tree)

    if (!response.ok) {
      throw new Error("Erreur lors de la modification de l'entrée d'historique")
    }

    res.json({
      message: "Entrée d'historique modifiée avec succès",
      entry: updatedEntry,
    })
  } catch (error) {
    console.error("Erreur lors de la modification de l'entrée d'historique:", error)
    if (error.statusCode === 404) {
      res.status(404).json({ error: "Arbre ou entrée d'historique non trouvé" })
    } else {
      res.status(500).json({ error: "Erreur lors de la modification de l'entrée d'historique" })
    }
  }
})

// Supprimer une entrée d'historique
router.delete("/:id/history/:year/:timestamp", async (req, res) => {
  try {
    const { id: treeId, year, timestamp } = req.params
    const userId = req.user.userId
    const db = await getDatabase()

    // Récupérer l'arbre existant
    const tree = await db.get(treeId)

    // Vérifier si l'utilisateur est membre du projet
    const project = await db.get(tree.projectId)
    if (!project.members.includes(userId)) {
      return res.status(403).json({ error: "Accès non autorisé à cet arbre" })
    }

    // Vérifier que l'historique et l'année existent
    if (!tree.history || !tree.history[year]) {
      return res.status(404).json({ error: "Entrée d'historique non trouvée" })
    }

    // Trouver l'entrée à supprimer
    const entryIndex = tree.history[year].findIndex((entry) => entry.timestamp === Number.parseInt(timestamp))

    if (entryIndex === -1) {
      return res.status(404).json({ error: "Entrée d'historique non trouvée" })
    }

    // Supprimer l'entrée
    tree.history[year].splice(entryIndex, 1)

    // Nettoyer l'année si elle est vide
    if (tree.history[year].length === 0) {
      delete tree.history[year]
    }

    // Mettre à jour l'arbre
    tree.updatedAt = new Date().toISOString()
    tree.updatedBy = userId

    // Enregistrer les modifications
    const response = await db.insert(tree)

    if (!response.ok) {
      throw new Error("Erreur lors de la suppression de l'entrée d'historique")
    }

    res.json({ message: "Entrée d'historique supprimée avec succès" })
  } catch (error) {
    console.error("Erreur lors de la suppression de l'entrée d'historique:", error)
    if (error.statusCode === 404) {
      res.status(404).json({ error: "Arbre ou entrée d'historique non trouvé" })
    } else {
      res.status(500).json({ error: "Erreur lors de la suppression de l'entrée d'historique" })
    }
  }
})

// Obtenir les statistiques de l'historique
router.get("/:id/history/stats", async (req, res) => {
  try {
    const treeId = req.params.id
    const userId = req.user.userId
    const { year } = req.query
    const db = await getDatabase()

    // Récupérer l'arbre
    const tree = await db.get(treeId)

    // Vérifier si l'utilisateur est membre du projet
    const project = await db.get(tree.projectId)
    if (!project.members.includes(userId)) {
      return res.status(403).json({ error: "Accès non autorisé à cet arbre" })
    }

    const history = tree.history || {}
    let allEntries = []

    // Collecter toutes les entrées ou seulement celles de l'année spécifiée
    if (year && history[year]) {
      allEntries = history[year]
    } else {
      Object.values(history).forEach((yearEntries) => {
        allEntries = allEntries.concat(yearEntries)
      })
    }

    if (allEntries.length === 0) {
      return res.json({
        totalEntries: 0,
        years: Object.keys(history),
        message: "Aucune donnée d'historique disponible",
      })
    }

    // Calculer les statistiques
    const heights = allEntries.filter((e) => e.height !== null && e.height !== undefined).map((e) => e.height)
    const diameters = allEntries.filter((e) => e.diameter !== null && e.diameter !== undefined).map((e) => e.diameter)

    const stats = {
      totalEntries: allEntries.length,
      dateRange: {
        first: new Date(Math.min(...allEntries.map((e) => new Date(e.date)))).toISOString(),
        last: new Date(Math.max(...allEntries.map((e) => new Date(e.date)))).toISOString(),
      },
      height:
        heights.length > 0
          ? {
              count: heights.length,
              min: Math.min(...heights),
              max: Math.max(...heights),
              avg: heights.reduce((a, b) => a + b, 0) / heights.length,
            }
          : null,
      diameter:
        diameters.length > 0
          ? {
              count: diameters.length,
              min: Math.min(...diameters),
              max: Math.max(...diameters),
              avg: diameters.reduce((a, b) => a + b, 0) / diameters.length,
            }
          : null,
      healthDistribution: {},
      years: Object.keys(history),
    }

    // Distribution de la santé
    allEntries.forEach((entry) => {
      if (entry.health) {
        stats.healthDistribution[entry.health] = (stats.healthDistribution[entry.health] || 0) + 1
      }
    })

    // Statistiques par année si pas d'année spécifiée
    if (!year) {
      stats.byYear = {}
      Object.keys(history).forEach((yearKey) => {
        const yearEntries = history[yearKey]
        const yearHeights = yearEntries.filter((e) => e.height !== null && e.height !== undefined).map((e) => e.height)
        const yearDiameters = yearEntries
          .filter((e) => e.diameter !== null && e.diameter !== undefined)
          .map((e) => e.diameter)

        stats.byYear[yearKey] = {
          count: yearEntries.length,
          avgHeight: yearHeights.length > 0 ? yearHeights.reduce((a, b) => a + b, 0) / yearHeights.length : null,
          avgDiameter:
            yearDiameters.length > 0 ? yearDiameters.reduce((a, b) => a + b, 0) / yearDiameters.length : null,
        }
      })
    }

    res.json(stats)
  } catch (error) {
    console.error("Erreur lors du calcul des statistiques:", error)
    if (error.statusCode === 404) {
      res.status(404).json({ error: "Arbre non trouvé" })
    } else {
      res.status(500).json({ error: "Erreur lors du calcul des statistiques" })
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

    // Mettre à jour les champs de l'arbre (sans toucher à l'historique)
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

    // Supprimer l'arbre (l'historique sera supprimé avec)
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
