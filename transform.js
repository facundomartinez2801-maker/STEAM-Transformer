export default async function handler(req, res) {

    // Permite que el navegador se conecte correctamente
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Respuesta automática a verificaciones del navegador
    if (req.method === 'OPTIONS') return res.status(200).end();

    // Solo acepta solicitudes POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    // Lee los datos que envió el formulario
    const { materia, tema, aprendizaje, problema } = req.body;

    // Validación básica
    if (!materia || !tema || !aprendizaje || aprendizaje.length < 5 || !problema || problema.length < 5) {
        return res.status(400).json({ error: 'Por favor completá todos los campos.' });
    }

    // Lee la API key desde las variables de entorno de Vercel (nunca está en el código)
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'El servidor no está configurado correctamente.' });
    }

    // Instrucciones para la IA
    const systemPrompt = `Eres un experto Mentor en Educación STEAM Ampliada de Córdoba.
Analiza el contexto de la clase y devuelve dos alternativas STEAM.
Responde ÚNICAMENTE con este formato JSON estricto, sin texto adicional:
{
    "pregunta": "Escribe una Pregunta Investigable, desafiante y abierta para los alumnos",
    "opcionA": {
        "s": "Cómo abordar la Ciencia de forma autónoma en este espacio curricular",
        "t": "Cómo abordar la Tecnología de forma autónoma en este espacio curricular",
        "e": "Cómo abordar la Ingeniería de forma autónoma en este espacio curricular",
        "a": "Cómo abordar las Artes de forma autónoma en este espacio curricular",
        "m": "Cómo abordar la Matemática de forma autónoma en este espacio curricular"
    },
    "opcionB": {
        "areas": "Espacios curriculares sugeridos para articular con este proyecto",
        "producto": "El producto final evidenciable del proyecto interdisciplinario",
        "descripcion": "Descripción detallada del proyecto interdisciplinario"
    }
}`;

    try {
        const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `Transforma esta clase en una propuesta STEAM: ${JSON.stringify({ materia, tema, aprendizaje, problema })}`
                        }]
                    }],
                    systemInstruction: {
                        parts: [{ text: systemPrompt }]
                    },
                    generationConfig: {
                        responseMimeType: "application/json"
                    }
                })
            }
        );

        // Si Gemini devuelve un error
        if (!geminiResponse.ok) {
            const errorDetails = await geminiResponse.text();
            console.error('Error de Gemini:', errorDetails);
            return res.status(502).json({ error: 'Error al contactar la IA. Intentá de nuevo.' });
        }

        const json = await geminiResponse.json();
        const rawText = json.candidates[0].content.parts[0].text;

        // Limpieza por si Gemini agrega marcadores de código
        const cleanText = rawText.replace(/```json|```/g, '').trim();
        const result = JSON.parse(cleanText);

        return res.status(200).json(result);

    } catch (error) {
        console.error('Error interno:', error);
        return res.status(500).json({ error: 'Error interno del servidor. Intentá de nuevo.' });
    }
}
