# API de Gestion des Arbres

Cette API permet de gérer des projets collaboratifs pour le recensement d'arbres. Elle est conçue pour fonctionner avec une application mobile React Native.

## Structure de l'API

L'API est organisée selon les principes REST et utilise Next.js API Routes pour implémenter les endpoints.

### Authentification

- `POST /api/auth/login` : Authentification d'un utilisateur

### Utilisateurs

- `GET /api/users` : Récupérer la liste des utilisateurs (pour les invitations)
- `POST /api/users` : Créer un nouvel utilisateur

### Projets

- `GET /api/projects` : Récupérer tous les projets de l'utilisateur connecté
- `POST /api/projects` : Créer un nouveau projet
- `GET /api/projects/:id` : Récupérer les détails d'un projet
- `PUT /api/projects/:id` : Mettre à jour un projet
- `DELETE /api/projects/:id` : Supprimer un projet

### Membres du projet

- `GET /api/projects/:id/members` : Récupérer tous les membres d'un projet
- `POST /api/projects/:id/members` : Ajouter un membre à un projet
- `DELETE /api/projects/:id/members/:userId` : Retirer un membre d'un projet

### Arbres

- `GET /api/projects/:id/trees` : Récupérer tous les arbres d'un projet
- `POST /api/projects/:id/trees` : Ajouter un nouvel arbre à un projet
- `GET /api/projects/:id/trees/:treeId` : Récupérer les détails d'un arbre
- `PUT /api/projects/:id/trees/:treeId` : Mettre à jour un arbre
- `DELETE /api/projects/:id/trees/:treeId` : Supprimer un arbre

## Modèles de données

### Utilisateur

\`\`\`json
{
"\_id": "user:123",
"type": "user",
"email": "user@example.com",
"name": "Alice"
}
\`\`\`

### Projet

\`\`\`json
{
"\_id": "project:abc123",
"type": "project",
"name": "Recensement Parc XYZ",
"description": "Projet de recensement du parc",
"location": {
"lat": 48.8566,
"lng": 2.3522,
"name": "Parc Central"
},
"owner": "user:123",
"members": ["user:123", "user:456"],
"created_at": "2025-04-10T10:00:00Z"
}
\`\`\`

### Arbre

\`\`\`json
{
"\_id": "tree:xyz789",
"type": "tree",
"project_id": "project:abc123",
"location": {
"lat": 48.8566,
"lng": 2.3522
},
"species": "Chêne",
"height": 15,
"diameter": 80,
"health_status": "good",
"notes": "Arbre en bonne santé",
"photos": [],
"created_by": "user:123",
"created_at": "2025-04-10T10:30:00Z",
"updated_at": "2025-04-11T14:20:00Z",
"updated_by": "user:456"
}
\`\`\`

## Utilisation avec une application mobile

Cette API est conçue pour être utilisée avec une application mobile React Native. Voici un exemple d'utilisation avec fetch :

\`\`\`javascript
// Exemple de connexion
const login = async (email, password) => {
const response = await fetch('https://votre-api.com/api/auth/login', {
method: 'POST',
headers: {
'Content-Type': 'application/json'
},
body: JSON.stringify({ email, password })
});

const data = await response.json();
return data;
};

// Exemple de récupération des projets
const getProjects = async (token) => {
const response = await fetch('https://votre-api.com/api/projects', {
headers: {
'Authorization': `Bearer ${token}`
}
});

const data = await response.json();
return data;
};
\`\`\`

## Sécurité

Cette API utilise un système d'authentification basé sur des tokens. Chaque requête (sauf l'authentification) doit inclure un header `Authorization` avec un token valide.

Pour les tests, vous pouvez également utiliser l'en-tête `x-api-key` avec la valeur `your-secret-api-key`.

## Installation et déploiement

1. Clonez ce dépôt
2. Installez les dépendances avec `npm install`
3. Lancez le serveur de développement avec `npm run dev`
4. Pour la production, déployez sur Vercel ou un autre service compatible avec Next.js
