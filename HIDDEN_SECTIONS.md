# Hidden Homepage Sections

This document tracks sections that have been temporarily hidden from the school homepage.

## Currently Hidden Sections

### 1. Extracurricular Activities Section
**Location:** `client/src/pages/school-homepage.tsx` (lines ~576-674)  
**Reason:** Temporarily commented out  
**Cards included:**
- Sports
- Music & Arts
- Competitions
- Leadership

**To re-enable:** Remove the comment markers `{/*` and `*/}` around the entire section

---

### 2. Computer Lab Card (Facilities Section)
**Location:** `client/src/pages/school-homepage.tsx` (lines ~735-754)  
**Reason:** Temporarily hidden per user request  
**Description:** Modern computer lab with internet access for digital literacy and research

**To re-enable:** Remove the comment markers around this card in the facilities section

---

### 3. Multi-Purpose Hall Card (Facilities Section)
**Location:** `client/src/pages/school-homepage.tsx` (lines ~756-775)  
**Reason:** Temporarily hidden per user request  
**Description:** Large hall for assemblies, events, performances, and community gatherings

**To re-enable:** Remove the comment markers around this card in the facilities section

---

## Notes
- All hidden sections are properly commented with instructions for re-enabling
- Grid layouts automatically adjust when cards are hidden
- Images and components are still imported and ready to use when sections are re-enabled
