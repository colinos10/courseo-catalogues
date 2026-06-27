import os
import json
import requests
from bs4 import BeautifulSoup

def generer_donnees_secours():
    """Génère de superbes données de démonstration réalistes si le scraping est bloqué."""
    print("⚠️ Utilisation des données de secours (Fallback) pour l'application...")
    return [
        {
            "id": "demo_1",
            "storeId": "1",
            "title": "Catalogue Promo Carrefour",
            "validUntil": "Valable jusqu'au 31 Décembre",
            "pdfUrl": "https://www.carrefour.fr",
            "imageUrl": "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=600",
            "products": [
                {
                    "id": "p_demo_1_1",
                    "name": "Panier Fruits & Légumes de Saison",
                    "imageUrl": "https://images.unsplash.com/photo-1610832958506-ee5633619141?auto=format&fit=crop&q=80&w=400",
                    "originalPrice": 12.50,
                    "promoPrice": 7.99,
                    "description": "Sélection fraîcheur directement du producteur",
                    "category": "Alimentation"
                }
            ]
        },
        {
            "id": "demo_2",
            "storeId": "2",
            "title": "Les Jours Heureux Lidl",
            "validUntil": "Valable cette semaine",
            "pdfUrl": "https://www.lidl.fr",
            "imageUrl": "https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&q=80&w=600",
            "products": [
                {
                    "id": "p_demo_2_1",
                    "name": "Chocolat Noir Bio Equitable",
                    "imageUrl": "https://images.unsplash.com/photo-1606312440539-c51c13d3c7a2?auto=format&fit=crop&q=80&w=400",
                    "originalPrice": 2.99,
                    "promoPrice": 1.49,
                    "description": "Tablette 100g premium",
                    "category": "Alimentation"
                }
            ]
        }
    ]

def recuperer_catalogues_bonial():
    url = "https://www.bonial.fr/shelf?lat=48.8558&lng=2.3494&zip=75003&city=Paris"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7"
    }
    
    try:
        print("Connexion à Bonial...")
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code != 200:
            print(f"Erreur de connexion (Code {response.status_code})")
            return generer_donnees_secours()

        soup = BeautifulSoup(response.text, 'html.parser')
        
        # 1. Tentative d'extraction moderne via le JSON NextJS (extrêmement puissant)
        next_data_script = soup.find('script', id='__NEXT_DATA__')
        if next_data_script:
            try:
                print("Détection d'une structure Next.js, extraction du JSON brut...")
                payload = json.loads(next_data_script.string)
                # Exploration du dictionnaire pour trouver les brochures
                page_props = payload.get("props", {}).get("pageProps", {})
                
                # Liste générique pour chercher les données des brochures
                brochures_data = page_props.get("brochures") or page_props.get("shelf", {}).get("brochures")
                
                if brochures_data:
                    catalogues = []
                    for index, b in enumerate(brochures_data[:12]):
                        catalogues.append({
                            "id": f"scraped_{b.get('id', index)}",
                            "storeId": str((index % 3) + 1),
                            "title": f"Catalogue {b.get('publisherName', 'Enseigne')}",
                            "validUntil": "Valable cette semaine",
                            "pdfUrl": b.get("publishedUrl") or f"https://www.bonial.fr/catalogue/{b.get('id')}",
                            "imageUrl": b.get("titleImage", {}).get("url") or "",
                            "products": [
                                {
                                    "id": f"p_scraped_{index}_1",
                                    "name": "Produit Vedette",
                                    "imageUrl": "https://images.unsplash.com/photo-1542838132-92c53300491e",
                                    "originalPrice": 5.99,
                                    "promoPrice": 3.99,
                                    "description": "Consultez le catalogue pour en savoir plus !",
                                    "category": "Promo"
                                }
                            ]
                        })
                    if catalogues:
                        print(f"Extraction Next.js réussie : {len(catalogues)} catalogues trouvés !")
                        return catalogues
            except Exception as e:
                print(f"Échec de l'analyse Next.js ({e}), passage aux sélecteurs HTML classiques...")

        # 2. Sélecteurs HTML classiques (HTML Fallback)
        brochures = soup.select('div[class*="brochure"]') or soup.select('a[href*="/catalogue/"]')
        if not brochures:
            print("Aucune brochure trouvée via HTML classique.")
            return generer_donnees_secours()

        catalogues = []
        for index, card in enumerate(brochures[:12]):
            try:
                img_tag = card.find('img')
                enseigne = img_tag.get('alt', 'Catalogue').replace('Catalogue ', '').strip() if img_tag else "Catalogue"
                image_url = img_tag.get('src') if img_tag else ""
                if image_url and image_url.startswith('//'):
                    image_url = 'https:' + image_url

                link_tag = card if card.name == 'a' else card.find('a')
                lien_complet = ""
                if link_tag and link_tag.get('href'):
                    href = link_tag.get('href')
                    lien_complet = href if href.startswith('http') else f"https://www.bonial.fr{href}"

                catalogues.append({
                    "id": f"scraped_{index}",
                    "storeId": str((index % 3) + 1),
                    "title": f"Catalogue {enseigne}",
                    "validUntil": "Valable cette semaine",
                    "pdfUrl": lien_complet,
                    "imageUrl": image_url,
                    "products": [
                        {
                            "id": f"p_scraped_{index}_1",
                            "name": "Sélection Promo",
                            "imageUrl": "https://images.unsplash.com/photo-1542838132-92c53300491e",
                            "originalPrice": 4.99,
                            "promoPrice": 2.99,
                            "description": "Offre spéciale catalogue",
                            "category": "Alimentation"
                        }
                    ]
                })
            except Exception as e:
                print(f"Erreur catalogue individuel : {e}")
                continue

        if not catalogues:
            return generer_donnees_secours()
            
        return catalogues

    except Exception as e:
        print(f"Erreur globale lors de la récupération : {e}")
        return generer_donnees_secours()

if __name__ == "__main__":
    data = recuperer_catalogues_bonial()
    with open("catalogues.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)
    print(f"Fichier catalogues.json enregistré avec {len(data)} éléments.")
