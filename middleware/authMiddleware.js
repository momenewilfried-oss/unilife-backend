const jwt = require("jsonwebtoken");
const SECRET = process.env.JWT_SECRET;

module.exports = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        console.log("🔐 [AUTH] Header reçu :", authHeader);

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            console.log("❌ [AUTH] Token manquant ou format invalide");
            return res.status(401).json({ 
                success: false, 
                message: "Accès refusé : token manquant" 
            });
        }

        const token = authHeader.split(" ")[1];
        console.log("🔑 [AUTH] Token extrait");

        const decoded = jwt.verify(token, SECRET);
        console.log("✅ [AUTH] Token décodé avec succès →", decoded);

        req.user = decoded;
        next();

    } catch (err) {
        console.error("❌ [AUTH] Erreur JWT :", err.message);
        return res.status(401).json({ 
            success: false, 
            message: "Token invalide ou expiré" 
        });
    }
};