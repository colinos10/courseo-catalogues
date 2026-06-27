import os
import json
import requests
from bs4 import BeautifulSoup

def recuperer_catalogues_bonial():
    # URL ciblant Paris
    url = "https://www.bonial.fr/shelf?lat=48.8558&lng=2.3494&zip=75003&city=Paris"
    
    # On simule un vrai navigateur web pour éviter d'être bloqué
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

    # Extraction des catalogues sur la page
    brochures = soup.select('div[class*="brochure"]') or soup.select('a[href*="/catalogue/"]')

    for index, card in enumerate(brochures[:12]):  # Limite aux 12 premiers catalogues
        try:
            # Extraction du nom de l'enseigne
            img_tag = card.find('img')
            enseigne = img_tag.get('alt', 'Catalogue').replace('Catalogue ', '').strip() if img_tag else "Catalogue"
            
            # Image du catalogue
            image_url = img_tag.get('src') if img_tag else ""
            if image_url and image_url.startswith('//'):
                image_url = 'https:' + image_url

            # Lien vers le catalogue
            link_tag = card if card.name == 'a' else card.find('a')
            lien_complet = ""
            if link_tag and link_tag.get('href'):
                href = link_tag.get('href')
                lien_complet = href if href.startswith('http') else f"https://www.bonial.fr{href}"

            # On crée un faux storeId et une liste de faux produits pour alimenter ton app Android
            catalogues.append({
                "id": f"scraped_{index}",
                "storeId": str((index % 3) + 1), # Distribue entre les magasins 1, 2 et 3
                "title": f"Catalogue {enseigne}",
                "validUntil": "Valable cette semaine",
                "pdfUrl": lien_complet,
                "imageUrl": image_url,
                "products": [
                    {
                        "id": f"p_scraped_{index}_1",
                        "name": f"Sélection Promo {enseigne} 1",
                        "imageUrl": "https://images.unsplash.com/photo-1542838132-92c53300491e",
                        "originalPrice": 4.99,
                        "promoPrice": 2.99,
                        "description": "Offre spéciale catalogue",
                        "category": "Alimentation"
                    },
                    {
                        "id": f"p_scraped_{index}_2",
                        "name": f"Sélection Promo {enseigne} 2",
                        "imageUrl": "https://images.unsplash.com/photo-1506084868230-bb9d95c24759",
                        "originalPrice": 8.50,
                        "promoPrice": 5.00,
                        "description": "À retrouver en rayon",
                        "category": "Frais"
                    }
                ]
            })
        except Exception as e:
            print(f"Erreur lors de l'extraction d'un catalogue : {e}")
            continue

    return catalogues

if __name__ == "__main__":
    data = recuperer_catalogues_bonial()
    # Sauvegarde dans le fichier local
    with open("catalogues.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)
    print(f"Extraction terminée avec succès ! {len(data)} catalogues enregistrés.")
