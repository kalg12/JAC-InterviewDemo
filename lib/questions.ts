export type QuizOption = {
  id: string;
  label: string;
  emoji: string;
  mood: string;
};

export type QuizQuestion = {
  id: string;
  prompt: string;
  correctOptionId: string;
  options: QuizOption[];
};

export const joinCode = "JAC2026";

export const questions: QuizQuestion[] = [
  {
    id: "promo-mix",
    prompt: "¿Qué elemento de la mezcla de promoción utilizamos más los vendedores de JAC?",
    correctOptionId: "ventas-personales",
    options: [
      {
        id: "ventas-personales",
        label: "Ventas personales",
        emoji: "🤝",
        mood: "La conexión directa"
      },
      {
        id: "publicidad",
        label: "Publicidad",
        emoji: "📣",
        mood: "La voz de la marca"
      },
      {
        id: "relaciones-publicas",
        label: "Relaciones públicas",
        emoji: "🌐",
        mood: "La reputación que conecta"
      }
    ]
  },
  {
    id: "marketing-solucion",
    prompt: "¿Es el marketing recomendable para que el cliente visualice la solución que le brinda un producto?",
    correctOptionId: "3-0",
    options: [
      {
        id: "1-0",
        label: "1.0",
        emoji: "😶",
        mood: "Poco expresivo"
      },
      {
        id: "4-0",
        label: "4.0",
        emoji: "🤖",
        mood: "Demasiado tecnológico"
      },
      {
        id: "3-0",
        label: "3.0",
        emoji: "✨",
        mood: "Visualiza soluciones"
      }
    ]
  },
  {
    id: "lealtad",
    prompt: "Es mejor tener clientes por:",
    correctOptionId: "lealtad-satisfaccion",
    options: [
      {
        id: "lealtad-espuria",
        label: "Lealtad espuria",
        emoji: "🎭",
        mood: "Se queda, pero sin conexión real"
      },
      {
        id: "lealtad-satisfaccion",
        label: "Lealtad por satisfacción",
        emoji: "😍",
        mood: "Se queda porque le encanta"
      },
      {
        id: "sustitucion",
        label: "Por sustitución",
        emoji: "🔁",
        mood: "Se cambia por necesidad"
      }
    ]
  },
  {
    id: "valor-humano",
    prompt: "Este valor humano valida preocupaciones del cliente:",
    correctOptionId: "empatia",
    options: [
      {
        id: "amabilidad",
        label: "Amabilidad",
        emoji: "🙂",
        mood: "Cercanía cordial"
      },
      {
        id: "empatia",
        label: "Empatía",
        emoji: "🫶",
        mood: "Comprende lo que siente"
      },
      {
        id: "interaccion",
        label: "Interacción",
        emoji: "💬",
        mood: "Genera conversación"
      }
    ]
  }
];

export const sessionTitle = "JAC Live Pulse";
