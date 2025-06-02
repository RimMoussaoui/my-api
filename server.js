// server.js
const express = require("express")
const cors = require("cors")
const bodyParser = require("body-parser")
const { initDatabase } = require("./db/init")

// Créer l'application Express
const app = express()
const PORT = process.env.PORT || 8081

// Middleware
app.use(cors())

// Augmenter la limite de taille pour les requêtes JSON
app.use(bodyParser.json({ limit: '10mb' }))
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }))

// Middleware de journalisation
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`)
  next()
})

// Initialiser la base de données avant de démarrer le serveur
;(async () => {
  try {
    await initDatabase()

    // Routes
    app.use("/api/auth", require("./routes/auth"))
    app.use("/api/users", require("./routes/users"))
    app.use("/api/projects", require("./routes/projects"))
    app.use("/api/trees", require("./routes/trees"))

    // Route de test
    app.get("/api/test", (req, res) => {
      res.json({ message: "API fonctionnelle!" })
    })

    // Gestion des erreurs
    app.use((err, req, res, next) => {
      console.error("Erreur non gérée:", err)
      res.status(500).json({ error: "Erreur serveur interne" })
    })

    // Démarrer le serveur
    app.listen(PORT, () => {
      console.log(`Serveur démarré sur le port ${PORT}`)
    })
  } catch (error) {
    console.error("Erreur lors de l'initialisation de la base de données:", error)
    process.exit(1)
  }
})()
