const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const app = express();

/* =========================
   MIDDLEWARES
========================= */
app.use(cors({
    origin: "*",
    credentials: true
}));

app.use(express.json());

const authMiddleware = require("./middleware/authMiddleware");

/* =========================
   SUPABASE
========================= */
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

/* =========================
   HELPER : Récupérer user_id
========================= */
const getUserId = (req) => {
    return req.user?.id || req.user?.user_id;
};

/* =========================
   ROUTES
========================= */
const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);

/* =========================
   ROUTES PUBLIQUES
========================= */
app.get("/", (req, res) => {
    res.status(200).json({ success: true, message: "UNILIFE BACKEND ONLINE 🚀" });
});

app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
});

/* =========================
   GET OR CREATE CLASS (Insensible à la casse)
========================= */
async function getOrCreateClass(className, userId) {
    if (!className || !userId) throw new Error("Classe et User ID requis");

    const normalizedName = className.trim().toLowerCase();

    // Recherche insensible à la casse
    const { data: existingClass } = await supabase
        .from("classes")
        .select("id")
        .eq("user_id", userId)
        .eq("name", normalizedName)
        .maybeSingle();

    if (existingClass) {
        return existingClass.id;
    }

    // Création de la classe en minuscule
    const { data, error } = await supabase
        .from("classes")
        .insert([{ 
            name: normalizedName, 
            user_id: userId 
        }])
        .select("id");

    if (error) throw error;
    return data[0].id;
}

/* =========================
   SAVE STUDENT + SUBJECTS
========================= */
app.post("/save", authMiddleware, async (req, res) => {
    try {
        const { class_name, student_name, moyenne, mention, total_coef, subjects } = req.body;
        const userId = getUserId(req);

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Authentification requise"
            });
        }

        if (!class_name || !student_name) {
            return res.status(400).json({
                success: false,
                message: "Classe et nom de l'étudiant requis"
            });
        }

        const classId = await getOrCreateClass(class_name, userId);

        // Enregistrer l'étudiant
        const { data: studentData, error: studentError } = await supabase
            .from("students")
            .insert([{
                nom: student_name,
                moyenne,
                mention,
                total_coef,
                class_id: classId,
                user_id: userId
            }])
            .select("id");

        if (studentError) throw studentError;

        const studentId = studentData[0].id;

        // Enregistrer les matières
        const subjectsToInsert = subjects.map(subject => ({
            nom_matiere: subject.nom_matiere,
            note: subject.note,
            coef: subject.coef,
            student_id: studentId,
            class_id: classId,
            user_id: userId
        }));

        const { error: subjectError } = await supabase
            .from("subjects")
            .insert(subjectsToInsert);

        if (subjectError) throw subjectError;

        res.json({
            success: true,
            message: "Bulletin enregistré avec succès ✓"
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: "Erreur serveur"
        });
    }
});

/* =========================
   GET STUDENTS
========================= */
app.get("/students", authMiddleware, async (req, res) => {
    try {
        const userId = getUserId(req);

        const { data, error } = await supabase
            .from("students")
            .select(`
                *,
                classes(name)
            `)
            .eq("user_id", userId)
            .order("id", { ascending: false });

        if (error) throw error;

        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
});

/* =========================
   GET SUBJECTS
========================= */
app.get("/student/:id/subjects", authMiddleware, async (req, res) => {
    try {
        const userId = getUserId(req);

        const { data, error } = await supabase
            .from("subjects")
            .select("*")
            .eq("student_id", req.params.id)
            .eq("user_id", userId);

        if (error) throw error;

        res.json(data);
    } catch (err) {
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
});

/* =========================
   DELETE STUDENT
========================= */
app.delete("/student/:id", authMiddleware, async (req, res) => {
    try {
        const userId = getUserId(req);

        await supabase
            .from("subjects")
            .delete()
            .eq("student_id", req.params.id)
            .eq("user_id", userId);

        const { error } = await supabase
            .from("students")
            .delete()
            .eq("id", req.params.id)
            .eq("user_id", userId);

        if (error) throw error;

        res.json({ success: true, message: "Étudiant supprimé" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
});

/* =========================
   LANCEMENT SERVEUR
========================= */
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`✅ UNILIFE SERVER RUNNING ON PORT ${PORT}`);
});