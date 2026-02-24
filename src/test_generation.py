import unittest

def format_prompt(theme=None):
    base_prompt = "Tu es un professeur de français expert dans la préparation au Brevet des collèges. "
    base_prompt += "Génère un texte de dictée original pour des élèves de 3ème. "
    base_prompt += "Le texte doit être court (environ 50-80 mots), avoir un sens littéraire, "
    base_prompt += "et inclure des difficultés grammaticales classiques du Brevet (accords complexes, conjugaisons). "
    
    if theme:
        base_prompt += f"Le thème est : {theme}. "
    
    base_prompt += "\nRéponds UNIQUEMENT avec le texte de la dictée. Pas d'introduction, pas de conclusion, pas de commentaires."
    
    return base_prompt

class TestGenLogic(unittest.TestCase):
    def test_prompt_contains_constraints(self):
        prompt = format_prompt()
        self.assertIn("3ème", prompt)
        self.assertIn("UNIQUEMENT", prompt)
        self.assertIn("littéraire", prompt)
        
    def test_prompt_with_theme(self):
        theme = "la mer"
        prompt = format_prompt(theme)
        self.assertIn("la mer", prompt)

if __name__ == "__main__":
    unittest.main()
