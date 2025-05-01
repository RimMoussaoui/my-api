const nano = require('nano');
const dotenv = require('dotenv');

dotenv.config();

// Configuration de la connexion à CouchDB
const COUCHDB_URL = process.env.COUCHDB_URL || 'http://admin:romly5@192.168.1.116:5984';
const DB_NAME = process.env.DB_NAME || 'tree_database';

// Créer une instance de connexion à CouchDB
const couch = nano(COUCHDB_URL);

// Fonction pour initialiser la base de données
async function setupDatabase() {
  try {
    // Vérifier si la base de données existe, sinon la créer
    const dbList = await couch.db.list();
    
    if (!dbList.includes(DB_NAME)) {
      console.log(`Création de la base de données ${DB_NAME}...`);
      await couch.db.create(DB_NAME);
    }
    
    // Obtenir une référence à la base de données
    const db = couch.use(DB_NAME);
    
    // Créer les index nécessaires
    await createIndexes(db);
    
    return db;
  } catch (error) {
    console.error('Erreur lors de la configuration de la base de données:', error);
    throw error;
  }
}

// Fonction pour créer les index nécessaires
async function createIndexes(db) {
  try {
    // Index pour les utilisateurs par email
    await db.createIndex({
      index: { fields: ['type', 'email'] },
      name: 'user-email-index'
    });
    
    // Index pour les projets par propriétaire
    await db.createIndex({
      index: { fields: ['type', 'owner'] },
      name: 'project-owner-index'
    });
    
    // Index pour les projets par membres
    await db.createIndex({
      index: { fields: ['type', 'members'] },
      name: 'project-members-index'
    });
    
    // Index pour les arbres par projet
    await db.createIndex({
      index: { fields: ['type', 'project_id'] },
      name: 'tree-project-index'
    });
    
    console.log('Indexes créés avec succès');
  } catch (error) {
    console.error('Erreur lors de la création des index:', error);
    throw error;
  }
}

module.exports = {
  setupDatabase
};
