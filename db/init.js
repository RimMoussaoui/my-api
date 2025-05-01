// db/init.js
const nano = require("nano")
const couch = nano(process.env.COUCHDB_URL)

let dbConnection = null
const db = couch.db.use(process.env.DB_NAME); 
/**
 * Initialise la connexion à la base de données CouchDB
 * @returns {Object} - Instance de la base de données
 */
const initDatabase = async () => {
  if (db) return db

  console.log("Initialisation de la connexion à CouchDB...")

  // URL de connexion à CouchDB (à modifier selon votre configuration)
  const couchdbUrl = process.env.COUCHDB_URL || "http://admin:romlyj6@192.168.1.116:5984"

  try {
    // Créer la connexion à CouchDB
    dbConnection = nano(couchdbUrl)

    // Nom de la base de données
    const dbName = "tree_database"

    // Vérifier si la base de données existe, sinon la créer
    const dbList = await dbConnection.db.list()

    if (!dbList.includes(dbName)) {
      console.log(`Base de données '${dbName}' non trouvée, création en cours...`)
      await dbConnection.db.create(dbName)
      console.log(`Base de données '${dbName}' créée avec succès`)
    }

    // Se connecter à la base de données
    db = dbConnection.use(dbName)

    // Créer les index nécessaires
    await createIndexes()

    console.log("Connexion à CouchDB établie avec succès")
    return db
  } catch (error) {
    console.error("Erreur lors de l'initialisation de CouchDB:", error)
    throw error
  }
}

/**
 * Crée les index nécessaires dans la base de données
 */
const createIndexes = async () => {
  try {
    // Index pour le type de document
    await db.createIndex({
      index: {
        fields: ["type"],
      },
      name: "type-index",
    })
    console.log('Index sur le champ "type" créé avec succès')

    // Index pour le type et l'email
    await db.createIndex({
      index: {
        fields: ["type", "email"],
      },
      name: "type-email-index",
    })
    console.log('Index sur les champs "type" et "email" créé avec succès')

    // Index pour le type et les membres
    await db.createIndex({
      index: {
        fields: ["type", "members"],
      },
      name: "type-members-index",
    })
    console.log('Index sur les champs "type" et "members" créé avec succès')
  } catch (error) {
    console.error("Erreur lors de la création des index:", error)
  }
}

/**
 * Récupère l'instance de la base de données
 * @returns {Object} - Instance de la base de données
 */
const getDatabase = async () => {
  if (!db) {
    return await initDatabase()
  }
  return db
}

module.exports = {
  initDatabase,
  getDatabase,
}
