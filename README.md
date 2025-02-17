# Obsidian Audiobookshelf Importer

## \*\*This is a work in progress, please treat it as such 😼 - as of now, templating isn't implemented.\*\*

📖 **Obsidian Audiobookshelf Importer** is an Obsidian plugin that fetches audiobook metadata from **[Audiobookshelf](https://www.audiobookshelf.org/)** via its API and creates structured markdown notes in your Obsidian vault.

## 🚀 Features
✅ Fetches audiobook data from an **Audiobookshelf** instance  
✅ Uses **configurable settings** for API connection and file structure  
✅ Automatically **creates missing folders**  
❌ Supports **custom markdown templates** for new audiobook notes  
✅ Organizes notes under **`<settings.folder>/authorLastFirst/<Series if exists>/title.md`**  

---

## 🔧 Installation
1. **Download Repo + Extract**
2. **Navigate to your Obsidian vault**:
   ```
   cd </path/to/obsidian/vault>/.obsidian/plugins/
   ```
3. **Copy Repo Folder**:
   ```
   cp -rf ~/Downloads/obsidian-audiobookshelf-importer .
   ```
4. **Restart Obsidian** and enable **Obsidian Audiobookshelf Importer**.

---

| **Setting**   | **Description** |
|--------------|---------------|
| **`host`** | The base URL of your **Audiobookshelf** API (**exclude `https://`**). |
| **`library`** | The **library ID** used for fetching audiobooks. Extract only the unique identifier from the URL: `https://abs.ex.org/audiobookshelf/library/`[**`ads76yfsd-sd767-p9aa-34dsd-989s8dasd`**]. |
| **`token`** | Your **API token** for authentication. Find in `Settings > Users > <USER>` |
| **`folder`** | The **base directory** in Obsidian where audiobook notes will be stored, organized by `AuthorLastNameFirstName`, then by series. |
| **`template`** | A Markdown **template** for newly created audiobook notes (**not yet implemented**). |

### 📁 File Structure
Audiobook notes are stored in:
```
<settings.folder>/authorLastFirst/<Series if exists>/title.md
```
🔹 **Example Output for Terry Goodkind’s Book**:
```
Audiobooks/
  ├── GoodkindTerry/
  │   ├── Sword of Truth/
  │   │   ├── Wizards First Rule.md
```

<!-- ---

## 📜 Markdown Template Example
You can define your own **markdown template** using placeholders.

Example:
```
# {{title}}

**Author:** {{author}}  
**Narrator:** {{narrator}}  
**Series:** {{series}} (Book {{seriesNumber}})  
**Published:** {{publishedYear}}  
**Publisher:** {{publisher}}  
**ASIN:** {{asin}}

## 📜 Description
{{description}}
```

### 🔹 Supported Placeholders
- `{{title}}`
- `{{author}}`
- `{{narrator}}`
- `{{series}}`
- `{{seriesNumber}}`
- `{{publishedYear}}`
- `{{publisher}}`
- `{{asin}}`
- `{{description}}` -->

---

## 🛠️ Usage
1. **Configure the plugin settings** in **Obsidian → Community Plugins → Obsidian Audiobookshelf Importer**.
2. **Run the fetch command** 

* From the Command Palette:  
   ```
   Fetch audiobooks from Audiobookshelf
   ```
* From the Sidebar:
   ```
   Click the book icon that gets added.
   ```
3. The plugin will:
   - Retrieve audiobook metadata from Audiobookshelf
   - Organize notes in the defined folder structure
   - Apply the markdown template
   - Create missing folders if they don’t exist

---

## 📜 License
MIT License. Feel free to modify and contribute! 😊

---

### 🚀 Future Improvements
- ✅ Add **automatic cover image download**
- ✅ Add **more metadata fields**
- ✅ Support **multiple libraries**
- ✅ Add **progress tracking for audiobooks**
