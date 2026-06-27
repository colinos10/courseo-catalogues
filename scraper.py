import os
import json
import requests
from bs4 import BeautifulSoup

def recuperer_catalogues_bonial():
    # URL ciblant Paris
    url = "https://www.bonial.fr/shelf?lat=48.8558&lng=2.3494&zip=75003&city=Paris"
    
    # On simule un vrai navigateur web pour éviter d'être bloqué par le site
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7"
    }
    
    print("Connexion à Bonial...")
    response = requests.get(url, headers=headers)
    if response.status_code != 200:
        print(f"Erreur de connexion (Code {response.status_code})")
        return []

    soup = BeautifulSoup(response.text, 'html.parser')
    catalogues = []

    # Extraction des catalogues (s'adapte aux structures courantes de Bonial)
    brochures = soup.select('div[class*="brochure"]') or soup.select('a[href*="/catalogue/"]')

    for index, card in enumerate(brochures[:12]):  # On limite aux 12 premiers catalogues
        try:
            # Recherche du titre/enseigne
            img_tag = card.find('img')
            enseigne = img_tag.get('alt', 'Catalogue').replace('Catalogue ', '').strip() if img_tag else "Catalogue"
            
            # Recherche de l'image du prospectus
            image_url = img_tag.get('src') if img_tag else ""
            if image_url and image_url.startswith('//'):
                image_url = 'https:' + image_url

            # Recherche du lien vers le catalogue
            link_tag = card if card.name == 'a' else card.find('a')
            lien_complet = ""
            if link_tag and link_tag.get('href'):
                href = link_tag.get('href')
                lien_complet = href if href.startswith('http') else "https://www.bonial.fr" + href

            if enseigne and image_url:
                catalogues.append({
                    "id": index + 1,
                    "name": enseigne,
                    "imageUrl": image_url,
                    "pdfUrl": lien_complet,  # Lien vers la version interactive
                    "validity": "Disponible"
                })
        except Exception as e:
            print(f"Impossible de lire un catalogue : {e}")
            continue

    return catalogues

if __name__ == "__main__":
    donnees = recuperer_catalogues_bonial()
    if donnees:
        # On sauvegarde le résultat final dans catalogues.json
        with open("catalogues.json", "w", encoding="utf-8") as f:
            json.dump(donnees, f, indent=4, ensure_ascii=False)
        print(f"Mise à jour réussie : {len(donnees)} catalogues récupérés.")
    else:
        print("Aucun catalogue récupéré, fichier non mis à jour.")
