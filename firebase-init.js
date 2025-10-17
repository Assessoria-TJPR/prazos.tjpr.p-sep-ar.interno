// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD1ApCkzPbBRNJUCkAGet9DBKb1uE9O1Bo",
  authDomain: "djen-com-minuta.firebaseapp.com",
  projectId: "djen-com-minuta",
  storageBucket: "djen-com-minuta.firebasestorage.app",
  messagingSenderId: "498664224312",
  appId: "1:498664224312:web:6de6a453d9e36138a398cd",
  measurementId: "G-MCV0ZCD3Y1"
};

// Inicializa o Firebase e torna as variáveis globais
let app;
try {
    app = firebase.initializeApp(firebaseConfig);
} catch (e) {
    console.error("Erro ao inicializar o Firebase:", e);
}

const auth = app ? firebase.auth() : null;
const db = app ? firebase.firestore() : null;
const storage = app ? firebase.storage() : null;