// routes/projects.js
const express = require("express")
const router = express.Router()
const { getDatabase } = require("../db/init")
const { authenticateToken } = require("../middleware/auth")

// Middleware d'authentification pour toutes les routes de projets
router.use(authenticateToken)

// Créer un nouveau projet
router.post("/", async (req, res) => {
  try {
    const { name, description, location } = req.body
    const userId = req.user.userId

    if (!name) {
      return res.status(400).json({ error: "Le nom du projet est requis" })
    }

    const db = await getDatabase()

    // Créer un nouveau projet avec l'utilisateur actuel comme propriétaire et membre
    const newProject = {
      _id: `project:${Date.now()}`,
      type: "project",
      name,
      description: description || "",
      location: location || null,
      owner: userId,
      members: [userId], // Le créateur est automatiquement membre
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Enregistrer le projet dans la base de données
    const response = await db.insert(newProject)

    if (!response.ok) {
      throw new Error("Erreur lors de la création du projet")
    }

    res.status(201).json(newProject)
  } catch (error) {
    console.error("Erreur lors de la création du projet:", error)
    res.status(500).json({ error: "Erreur lors de la création du projet" })
  }
})

// Récupérer tous les projets de l'utilisateur (créés ou membre)
router.get("/", async (req, res) => {
  try {
    const userId = req.user.userId
    const db = await getDatabase()

    console.log("Recherche des projets pour l'utilisateur:", userId)

    // Rechercher tous les projets où l'utilisateur est membre
    const result = await db.find({
      selector: {
        type: "project",
        members: { $elemMatch: { $eq: userId } },
      },
    })

    console.log("Projets trouvés:", result.docs.length)
    res.json(result.docs)
  } catch (error) {
    console.error("Erreur détaillée lors de la récupération des projets:", error)
    res.status(500).json({ error: "Erreur lors de la récupération des projets" })
  }
})

// Récupérer un projet spécifique
router.get("/:id", async (req, res) => {
  try {
    const projectId = req.params.id
    const userId = req.user.userId
    const db = await getDatabase()

    // Récupérer le projet
    const project = await db.get(projectId)

    // Vérifier si l'utilisateur est membre du projet
    if (!project.members.includes(userId)) {
      return res.status(403).json({ error: "Accès non autorisé à ce projet" })
    }

    res.json(project)
  } catch (error) {
    console.error("Erreur lors de la récupération du projet:", error)
    if (error.statusCode === 404) {
      res.status(404).json({ error: "Projet non trouvé" })
    } else {
      res.status(500).json({ error: "Erreur lors de la récupération du projet" })
    }
  }
})

// Mettre à jour un projet
router.put("/:id", async (req, res) => {
  try {
    const projectId = req.params.id
    const userId = req.user.userId
    const { name, description, location } = req.body
    const db = await getDatabase()

    // Récupérer le projet existant
    const project = await db.get(projectId)

    // Vérifier si l'utilisateur est le propriétaire du projet
    if (project.owner !== userId) {
      return res.status(403).json({ error: "Seul le propriétaire peut modifier ce projet" })
    }

    // Mettre à jour les champs du projet
    const updatedProject = {
      ...project,
      name: name || project.name,
      description: description !== undefined ? description : project.description,
      location: location || project.location,
      updated_at: new Date().toISOString(),
    }

    // Enregistrer les modifications
    const response = await db.insert(updatedProject)

    if (!response.ok) {
      throw new Error("Erreur lors de la mise à jour du projet")
    }

    res.json(updatedProject)
  } catch (error) {
    console.error("Erreur lors de la mise à jour du projet:", error)
    if (error.statusCode === 404) {
      res.status(404).json({ error: "Projet non trouvé" })
    } else {
      res.status(500).json({ error: "Erreur lors de la mise à jour du projet" })
    }
  }
})

// Supprimer un projet
router.delete("/:id", async (req, res) => {
  try {
    const projectId = req.params.id
    const userId = req.user.userId
    const db = await getDatabase()

    // Récupérer le projet existant
    const project = await db.get(projectId)

    // Vérifier si l'utilisateur est le propriétaire du projet
    if (project.owner !== userId) {
      return res.status(403).json({ error: "Seul le propriétaire peut supprimer ce projet" })
    }

    // Supprimer le projet
    const response = await db.destroy(project._id, project._rev)

    if (!response.ok) {
      throw new Error("Erreur lors de la suppression du projet")
    }

    res.status(204).send()
  } catch (error) {
    console.error("Erreur lors de la suppression du projet:", error)
    if (error.statusCode === 404) {
      res.status(404).json({ error: "Projet non trouvé" })
    } else {
      res.status(500).json({ error: "Erreur lors de la suppression du projet" })
    }
  }
})

// Ajouter un membre au projet
router.post("/:id/members", async (req, res) => {
  try {
    const projectId = req.params.id
    const userId = req.user.userId
    const { memberId } = req.body
    const db = await getDatabase()

    if (!memberId) {
      return res.status(400).json({ error: "L'identifiant du membre est requis" })
    }

    // Récupérer le projet existant
    const project = await db.get(projectId)

    // Vérifier si l'utilisateur est le propriétaire du projet
    if (project.owner !== userId) {
      return res.status(403).json({ error: "Seul le propriétaire peut ajouter des membres" })
    }

    // Vérifier si l'utilisateur à ajouter existe
    try {
      await db.get(memberId)
    } catch (error) {
      return res.status(404).json({ error: "Utilisateur non trouvé" })
    }

    // Vérifier si l'utilisateur est déjà membre
    if (project.members.includes(memberId)) {
      return res.status(409).json({ error: "L'utilisateur est déjà membre de ce projet" })
    }

    // Ajouter le membre au projet
    project.members.push(memberId)
    project.updated_at = new Date().toISOString()

    // Enregistrer les modifications
    const response = await db.insert(project)

    if (!response.ok) {
      throw new Error("Erreur lors de l'ajout d'un membre")
    }

    res.json(project)
  } catch (error) {
    console.error("Erreur lors de l'ajout d'un membre:", error)
    if (error.statusCode === 404) {
      res.status(404).json({ error: "Projet non trouvé" })
    } else {
      res.status(500).json({ error: "Erreur lors de l'ajout d'un membre" })
    }
  }
})

// Supprimer un membre du projet
router.delete("/:id/members/:memberId", async (req, res) => {
  try {
    const projectId = req.params.id
    const userId = req.user.userId
    const memberId = req.params.memberId
    const db = await getDatabase()

    // Récupérer le projet existant
    const project = await db.get(projectId)

    // Vérifier si l'utilisateur est le propriétaire du projet
    if (project.owner !== userId) {
      return res.status(403).json({ error: "Seul le propriétaire peut supprimer des membres" })
    }

    // Vérifier si le membre à supprimer est le propriétaire
    if (memberId === project.owner) {
      return res.status(400).json({ error: "Le propriétaire ne peut pas être supprimé du projet" })
    }

    // Vérifier si l'utilisateur est membre
    if (!project.members.includes(memberId)) {
      return res.status(404).json({ error: "L'utilisateur n'est pas membre de ce projet" })
    }

    // Supprimer le membre du projet
    project.members = project.members.filter((member) => member !== memberId)
    project.updated_at = new Date().toISOString()

    // Enregistrer les modifications
    const response = await db.insert(project)

    if (!response.ok) {
      throw new Error("Erreur lors de la suppression d'un membre")
    }

    res.json(project)
  } catch (error) {
    console.error("Erreur lors de la suppression d'un membre:", error)
    if (error.statusCode === 404) {
      res.status(404).json({ error: "Projet non trouvé" })
    } else {
      res.status(500).json({ error: "Erreur lors de la suppression d'un membre" })
    }
  }
})

// Quitter un projet (pour un membre qui n'est pas propriétaire)
router.post("/:id/leave", async (req, res) => {
  try {
    const projectId = req.params.id
    const userId = req.user.userId
    const db = await getDatabase()

    // Récupérer le projet existant
    const project = await db.get(projectId)

    // Vérifier si l'utilisateur est membre du projet
    if (!project.members.includes(userId)) {
      return res.status(404).json({ error: "Vous n'êtes pas membre de ce projet" })
    }

    // Vérifier si l'utilisateur est le propriétaire
    if (project.owner === userId) {
      return res.status(400).json({
        error: "Le propriétaire ne peut pas quitter le projet. Transférez la propriété ou supprimez le projet.",
      })
    }

    // Supprimer l'utilisateur des membres du projet
    project.members = project.members.filter((member) => member !== userId)
    project.updated_at = new Date().toISOString()

    // Enregistrer les modifications
    const response = await db.insert(project)

    if (!response.ok) {
      throw new Error("Erreur lors de la sortie du projet")
    }

    res.json({ message: "Vous avez quitté le projet avec succès" })
  } catch (error) {
    console.error("Erreur lors de la sortie du projet:", error)
    if (error.statusCode === 404) {
      res.status(404).json({ error: "Projet non trouvé" })
    } else {
      res.status(500).json({ error: "Erreur lors de la sortie du projet" })
    }
  }
})

// Récupérer tous les membres d'un projet avec leurs informations
router.get("/:id/members", async (req, res) => {
  try {
    const projectId = req.params.id
    const userId = req.user.userId
    const db = await getDatabase()

    // Récupérer le projet
    const project = await db.get(projectId)

    // Vérifier si l'utilisateur est membre du projet
    if (!project.members.includes(userId)) {
      return res.status(403).json({ error: "Accès non autorisé à ce projet" })
    }

    // Récupérer les informations de tous les membres
    const members = []
    for (const memberId of project.members) {
      try {
        const member = await db.get(memberId)
        // Exclure le mot de passe et autres informations sensibles
        const { password, ...memberInfo } = member
        members.push(memberInfo)
      } catch (error) {
        console.warn(`Membre ${memberId} non trouvé`)
        // Continuer avec les autres membres
      }
    }

    res.json(members)
  } catch (error) {
    console.error("Erreur lors de la récupération des membres:", error)
    if (error.statusCode === 404) {
      res.status(404).json({ error: "Projet non trouvé" })
    } else {
      res.status(500).json({ error: "Erreur lors de la récupération des membres" })
    }
  }
})

// Récupérer tous les arbres d'un projet
router.get("/:id/trees", async (req, res) => {
  try {
    const projectId = req.params.id
    const userId = req.user.userId
    const db = await getDatabase()

    // Récupérer le projet
    const project = await db.get(projectId)

    // Vérifier si l'utilisateur est membre du projet
    if (!project.members.includes(userId)) {
      return res.status(403).json({ error: "Accès non autorisé à ce projet" })
    }

    // Rechercher tous les arbres du projet
    const result = await db.find({
      selector: {
        type: "tree",
        projectId: projectId,
      },
    })

    res.json(result.docs)
  } catch (error) {
    console.error("Erreur lors de la récupération des arbres:", error)
    if (error.statusCode === 404) {
      res.status(404).json({ error: "Projet non trouvé" })
    } else {
      res.status(500).json({ error: "Erreur lors de la récupération des arbres" })
    }
  }
})

// Compter le nombre d'arbres dans un projet
router.get("/:id/trees/count", async (req, res) => {
  try {
    const projectId = req.params.id
    const userId = req.user.userId
    const db = await getDatabase()

    // Récupérer le projet
    const project = await db.get(projectId)

    // Vérifier si l'utilisateur est membre du projet
    if (!project.members.includes(userId)) {
      return res.status(403).json({ error: "Accès non autorisé à ce projet" })
    }

    // Rechercher tous les arbres du projet
    const result = await db.find({
      selector: {
        type: "tree",
        projectId: projectId,
      },
    })

    res.json({ count: result.docs.length })
  } catch (error) {
    console.error("Erreur lors du comptage des arbres:", error)
    if (error.statusCode === 404) {
      res.status(404).json({ error: "Projet non trouvé" })
    } else {
      res.status(500).json({ error: "Erreur lors du comptage des arbres" })
    }
  }
})

module.exports = router
