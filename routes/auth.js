const express = require("express");
const router = express.Router();

// Import du client Supabase centralisé (recommandé)
const supabase = require("../data/supabase");

const {
    register,
    login,
    getUser
} = require("../controllers/authController");

const authMiddleware = require("../middleware/authMiddleware");

/* =========================
   AUTH ROUTES
========================= */

/* =========================
   REGISTER
========================= */
router.post("/register", register);

/* =========================
   LOGIN
========================= */
router.post("/login", login);

/* =========================
   GET CURRENT USER
========================= */
router.get("/me", authMiddleware, getUser);

/* =========================
   FORGOT PASSWORD (Récupération de mot de passe)
========================= */
router.post("/forgot-password", async (req, res) => {
    try {
        const { email } = req.body;

        if (!email || !email.includes("@")) {
            return res.status(400).json({
                success: false,
                message: "Veuillez fournir un email valide"
            });
        }

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: "http://localhost:5500/reset-password.html",
            // Optionnel : tu peux personnaliser le message
        });

        if (error) {
            console.error("Supabase Reset Password Error:", error);
            
            // Messages plus clairs pour l'utilisateur
            let message = "Impossible d'envoyer le lien de réinitialisation";
            if (error.message.includes("Email not found")) {
                message = "Aucun compte associé à cet email";
            }

            return res.status(400).json({
                success: false,
                message: message
            });
        }

        res.json({
            success: true,
            message: "Un lien de réinitialisation a été envoyé à votre adresse email"
        });

    } catch (err) {
        console.error("Server Error - Forgot Password:", err);
        res.status(500).json({
            success: false,
            message: "Erreur interne du serveur"
        });
    }
});

/* =========================
   (Optionnel) RESET PASSWORD - Si tu veux le gérer côté serveur plus tard
========================= */
// router.post("/reset-password", async (req, res) => {
//     try {
//         const { password } = req.body;
//         const { error } = await supabase.auth.updateUser({ password });

//         if (error) throw error;

//         res.json({
//             success: true,
//             message: "Mot de passe modifié avec succès"
//         });
//     } catch (err) {
//         res.status(500).json({
//             success: false,
//             message: err.message
//         });
//     }
// });

module.exports = router;