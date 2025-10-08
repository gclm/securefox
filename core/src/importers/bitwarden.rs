//! Bitwarden import/export functionality

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::errors::{Error, Result};
use crate::models::{
    CardData, CustomField, FieldType, Folder, IdentityData, Item, ItemType, LoginData, LoginUri,
    SecureNoteData, SecureNoteType, UriMatchType, Vault,
};

use super::{Exporter, Importer};

/// Bitwarden export format
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BitwardenExport {
    pub encrypted: Option<bool>,
    pub folders: Option<Vec<BitwardenFolder>>,
    pub items: Vec<BitwardenItem>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BitwardenFolder {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BitwardenItem {
    pub id: Option<String>,
    #[serde(rename = "type")]
    pub item_type: u8,
    pub name: String,
    pub folder_id: Option<String>,
    pub favorite: Option<bool>,
    pub notes: Option<String>,
    pub login: Option<BitwardenLogin>,
    pub card: Option<BitwardenCard>,
    pub identity: Option<BitwardenIdentity>,
    pub secure_note: Option<BitwardenSecureNote>,
    pub fields: Option<Vec<BitwardenField>>,
    pub reprompt: Option<u8>,
    pub creation_date: Option<String>,
    pub revision_date: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BitwardenLogin {
    pub username: Option<String>,
    pub password: Option<String>,
    pub totp: Option<String>,
    pub uris: Option<Vec<BitwardenUri>>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BitwardenUri {
    pub uri: String,
    #[serde(rename = "match")]
    pub match_type: Option<u8>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BitwardenCard {
    pub cardholder_name: Option<String>,
    pub number: Option<String>,
    pub exp_month: Option<String>,
    pub exp_year: Option<String>,
    pub code: Option<String>,
    pub brand: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BitwardenIdentity {
    pub title: Option<String>,
    pub first_name: Option<String>,
    pub middle_name: Option<String>,
    pub last_name: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub address1: Option<String>,
    pub address2: Option<String>,
    pub address3: Option<String>,
    pub city: Option<String>,
    pub state: Option<String>,
    pub postal_code: Option<String>,
    pub country: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BitwardenSecureNote {
    #[serde(rename = "type")]
    pub note_type: Option<u8>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BitwardenField {
    pub name: String,
    pub value: String,
    #[serde(rename = "type")]
    pub field_type: u8,
}

/// Bitwarden JSON importer
pub struct BitwardenImporter;

impl BitwardenImporter {
    pub fn new() -> Self {
        Self
    }

    fn convert_folder(folder: &BitwardenFolder) -> Folder {
        Folder {
            id: folder.id.clone(),
            name: folder.name.clone(),
        }
    }

    fn convert_item(item: &BitwardenItem) -> Result<Item> {
        let now = Utc::now();

        let creation_date = item
            .creation_date
            .as_ref()
            .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or(now);

        let revision_date = item
            .revision_date
            .as_ref()
            .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or(now);

        let id = item
            .id
            .clone()
            .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

        let mut converted = Item {
            id,
            item_type: ItemType(item.item_type),
            name: item.name.clone(),
            folder_id: item.folder_id.clone(),
            favorite: item.favorite.unwrap_or(false),
            notes: item.notes.clone(),
            login: None,
            card: None,
            identity: None,
            secure_note: None,
            fields: None,
            reprompt: item.reprompt,
            creation_date,
            revision_date,
        };

        // Convert login data
        if let Some(login) = &item.login {
            converted.login = Some(LoginData {
                username: login.username.clone(),
                password: login.password.clone(),
                totp: login.totp.clone(),
                uris: login.uris.as_ref().map(|uris| {
                    uris.iter()
                        .map(|uri| LoginUri {
                            uri: uri.uri.clone(),
                            match_type: uri.match_type.map(UriMatchType),
                        })
                        .collect()
                }),
            });
        }

        // Convert card data
        if let Some(card) = &item.card {
            converted.card = Some(CardData {
                cardholder_name: card.cardholder_name.clone(),
                number: card.number.clone(),
                exp_month: card.exp_month.clone(),
                exp_year: card.exp_year.clone(),
                code: card.code.clone(),
                brand: card.brand.clone(),
            });
        }

        // Convert identity data
        if let Some(identity) = &item.identity {
            converted.identity = Some(IdentityData {
                title: identity.title.clone(),
                first_name: identity.first_name.clone(),
                middle_name: identity.middle_name.clone(),
                last_name: identity.last_name.clone(),
                email: identity.email.clone(),
                phone: identity.phone.clone(),
                address1: identity.address1.clone(),
                address2: identity.address2.clone(),
                address3: identity.address3.clone(),
                city: identity.city.clone(),
                state: identity.state.clone(),
                postal_code: identity.postal_code.clone(),
                country: identity.country.clone(),
            });
        }

        // Convert secure note
        if let Some(note) = &item.secure_note {
            converted.secure_note = Some(SecureNoteData {
                type_: SecureNoteType(note.note_type.unwrap_or(0)),
            });
        }

        // Convert custom fields
        if let Some(fields) = &item.fields {
            converted.fields = Some(
                fields
                    .iter()
                    .map(|field| CustomField {
                        name: field.name.clone(),
                        value: field.value.clone(),
                        field_type: FieldType(field.field_type),
                    })
                    .collect(),
            );
        }

        Ok(converted)
    }
}

impl Importer for BitwardenImporter {
    fn import(&self, data: &str) -> Result<Vault> {
        let export: BitwardenExport = serde_json::from_str(data)
            .map_err(|e| Error::Import(format!("Invalid Bitwarden JSON: {}", e)))?;

        if export.encrypted == Some(true) {
            return Err(Error::Import(
                "Encrypted Bitwarden exports are not supported. Please export unencrypted."
                    .to_string(),
            ));
        }

        let mut vault = Vault::new();

        // Import folders
        if let Some(folders) = export.folders {
            vault.folders = folders.iter().map(Self::convert_folder).collect();
        }

        // Import items
        for item in export.items {
            let converted = Self::convert_item(&item)?;
            vault.items.push(converted);
        }

        Ok(vault)
    }
}

/// Bitwarden JSON exporter
pub struct BitwardenExporter;

impl BitwardenExporter {
    pub fn new() -> Self {
        Self
    }
}

impl Exporter for BitwardenExporter {
    fn export(&self, vault: &Vault) -> Result<String> {
        // Convert our vault format back to Bitwarden format
        let folders: Vec<BitwardenFolder> = vault
            .folders
            .iter()
            .map(|f| BitwardenFolder {
                id: f.id.clone(),
                name: f.name.clone(),
            })
            .collect();

        let items: Vec<BitwardenItem> = vault
            .items
            .iter()
            .map(|item| {
                let mut bw_item = BitwardenItem {
                    id: Some(item.id.clone()),
                    item_type: item.item_type.0,
                    name: item.name.clone(),
                    folder_id: item.folder_id.clone(),
                    favorite: Some(item.favorite),
                    notes: item.notes.clone(),
                    login: None,
                    card: None,
                    identity: None,
                    secure_note: None,
                    fields: None,
                    reprompt: item.reprompt,
                    creation_date: Some(item.creation_date.to_rfc3339()),
                    revision_date: Some(item.revision_date.to_rfc3339()),
                };

                // Convert login
                if let Some(login) = &item.login {
                    bw_item.login = Some(BitwardenLogin {
                        username: login.username.clone(),
                        password: login.password.clone(),
                        totp: login.totp.clone(),
                        uris: login.uris.as_ref().map(|uris| {
                            uris.iter()
                                .map(|uri| BitwardenUri {
                                    uri: uri.uri.clone(),
                                    match_type: uri.match_type.map(|m| m.0),
                                })
                                .collect()
                        }),
                    });
                }

                // Convert other types similarly...

                bw_item
            })
            .collect();

        let export = BitwardenExport {
            encrypted: Some(false),
            folders: Some(folders),
            items,
        };

        serde_json::to_string_pretty(&export)
            .map_err(|e| Error::Other(format!("Failed to serialize export: {}", e)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_import_basic_bitwarden() {
        let json = r#"{
            "encrypted": false,
            "folders": [
                {
                    "id": "folder-1",
                    "name": "Work"
                }
            ],
            "items": [
                {
                    "id": "item-1",
                    "type": 1,
                    "name": "GitHub",
                    "folderId": "folder-1",
                    "favorite": true,
                    "login": {
                        "username": "user@example.com",
                        "password": "password123",
                        "totp": "otpauth://totp/GitHub:user?secret=JBSWY3DPEHPK3PXP",
                        "uris": [
                            {
                                "uri": "https://github.com",
                                "match": 0
                            }
                        ]
                    }
                }
            ]
        }"#;

        let importer = BitwardenImporter::new();
        let vault = importer.import(json).unwrap();

        assert_eq!(vault.folders.len(), 1);
        assert_eq!(vault.items.len(), 1);
        assert_eq!(vault.items[0].name, "GitHub");
        assert!(vault.items[0].favorite);
        assert!(vault.items[0].login.is_some());
    }
}
