const supabase = require("../data/supabase");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET;

/* =========================
   REGISTER
========================= */
exports.register = async (req, res) => {

    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Tous les champs sont obligatoires"
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Le mot de passe doit contenir au moins 6 caractères"
            });
        }

        // Vérifier si l'email existe déjà
        const { data: exist } = await supabase
            .from("users")
            .select("id")
            .eq("email", email)
            .maybeSingle();

        if (exist) {
            return res.status(400).json({
                success: false,
                message: "Cet email est déjà utilisé"
            });
        }

        // Hash du mot de passe
        const hash = await bcrypt.hash(password, 10);

        // Création de l'utilisateur
        const { data, error } = await supabase
            .from("users")
            .insert([
                {
                    name,
                    email,
                    password: hash
                }
            ])
            .select("id, name, email")
            .single();

        if (error) {
            console.error(error);
            return res.status(500).json({
                success: false,
                message: "Erreur lors de la création du compte"
            });
        }

        const token = jwt.sign(
            {
                id: data.id,
                email: data.email,
                name: data.name
            },
            SECRET,
            { expiresIn: "7d" }
        );

        res.status(201).json({
            success: true,
            message: "Compte créé avec succès",
            token,
            user: {
                id: data.id,
                name: data.name,
                email: data.email
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: "Erreur serveur"
        });
    }
};

/* =========================
   LOGIN
========================= */
exports.login = async (req, res) => {

    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email et mot de passe sont obligatoires"
            });
        }

        const { data: user, error } = await supabase
            .from("users")
            .select("*")
            .eq("email", email)
            .maybeSingle();

        if (error) {
            console.error(error);
            return res.status(500).json({
                success: false,
                message: "Erreur serveur"
            });
        }

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Email ou mot de passe incorrect"
            });
        }

        const match = await bcrypt.compare(password, user.password);

        if (!match) {
            return res.status(401).json({
                success: false,
                message: "Email ou mot de passe incorrect"
            });
        }

        // Génération du token JWT
        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                name: user.name
            },
            SECRET,
            { expiresIn: "7d" }
        );

        res.json({
            success: true,
            message: "Connexion réussie",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: "Erreur serveur"
        });
    }
};

/* =========================
   GET CURRENT USER (/me)
========================= */
exports.getUser = async (req, res) => {

    try {
        const userId = req.user.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Utilisateur non authentifié"
            });
        }

        const { data: user, error } = await supabase
            .from("users")
            .select("id, name, email")
            .eq("id", userId)
            .maybeSingle();

        if (error) {
            console.error(error);
            return res.status(500).json({
                success: false,
                message: "Erreur serveur"
            });
        }

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Utilisateur introuvable"
            });
        }

        res.json({
            success: true,
            user
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: "Erreur serveur"
        });
    }
};