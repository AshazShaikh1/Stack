// Extension Configuration
// Update this to your production URL when deploying
const API_BASE = "http://localhost:3000"; // Change to your production URL

// State
let currentTab = null;
let selectedCardType = null;
let selectedFile = null;
let filePreview = null;

// DOM Elements
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const errorTextEl = document.getElementById('error-text');
const closeBtn = document.getElementById('close-btn');

// Step containers
const typeSelectionEl = document.getElementById('type-selection');
const linkDetailsEl = document.getElementById('link-details');
const fileDetailsEl = document.getElementById('file-details');

// Type selection
const typeOptions = document.querySelectorAll('.type-option');

// Link elements
const backBtnLink = document.getElementById('back-btn');
const previewTitleEl = document.getElementById('preview-title');
const previewUrlEl = document.getElementById('preview-url');
const previewDescriptionEl = document.getElementById('preview-description');
const previewImageEl = document.getElementById('preview-image');
const previewImageContainer = document.getElementById('preview-image-container');
const faviconEl = document.getElementById('favicon');
const saveLinkBtn = document.getElementById('save-link-btn');
const linkPreview = document.getElementById('link-preview');
const linkTextEl = document.getElementById('link-text');

// File elements
const backBtnFile = document.getElementById('back-btn-file');
const fileStepTitle = document.getElementById('file-step-title');
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const dropContent = document.getElementById('drop-content');
const filePreviewEl = document.getElementById('file-preview');
const filePreviewContent = document.getElementById('file-preview-content');
const removeFileBtn = document.getElementById('remove-file');
const fileTitleInput = document.getElementById('file-title');
const fileDescriptionInput = document.getElementById('file-description');
const fileTypesHint = document.getElementById('file-types');
const saveFileBtn = document.getElementById('save-file-btn');
const browseFileBtn = document.getElementById('browse-file-btn');
// Image method toggle elements (may not exist if not on image step)
const imageMethodToggle = document.getElementById('image-method-toggle');
const toggleFileBtn = document.getElementById('toggle-file');
const toggleUrlBtn = document.getElementById('toggle-url');
const imageUrlSection = document.getElementById('image-url-section');
const imageUrlInput = document.getElementById('image-url-input');
const imageUrlPreview = document.getElementById('image-url-preview');
const imageUrlPreviewImg = document.getElementById('image-url-preview-img');
const removeUrlBtn = document.getElementById('remove-url-btn');

// Close button handler
if (closeBtn) {
  closeBtn.addEventListener('click', () => {
    try {
      window.close();
    } catch (err) {
      // Some browsers don't allow programmatic close
    }
  });
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Get Current Tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.url) {
      throw new Error("Cannot access current tab URL.");
    }

    // Skip chrome:// and extension pages
    if (tab.url.startsWith('chrome://') || 
        tab.url.startsWith('chrome-extension://') || 
        tab.url.startsWith('edge://') ||
        tab.url.startsWith('about:') ||
        tab.url.startsWith('moz-extension://')) {
      throw new Error("Cannot save browser pages. Please navigate to a website.");
    }

    currentTab = tab;

    // Show type selection
    showTypeSelection();

  } catch (err) {
    showError(err.message || "An error occurred. Please try again.");
  }
});

// Type Selection Handlers
typeOptions.forEach(option => {
  option.addEventListener('click', () => {
    const type = option.dataset.type;
    selectCardType(type);
  });
});

function selectCardType(type) {
  selectedCardType = type;
  
  if (type === 'link') {
    showLinkDetails();
  } else if (type === 'image' || type === 'docs') {
    showFileDetails(type);
  }
}

function showTypeSelection() {
  hideAll();
  typeSelectionEl.style.display = 'block';
  loadingEl.style.display = 'none';
}

function showLinkDetails() {
  hideAll();
  linkDetailsEl.style.display = 'block';
  
  if (!currentTab) return;

  const url = currentTab.url;
  let hostname;
  try {
    hostname = new URL(url).hostname;
  } catch (e) {
    showError("Invalid URL. Please navigate to a valid website.");
    return;
  }

  // Set up UI immediately with tab data
  if (previewTitleEl) previewTitleEl.textContent = currentTab.title || "Untitled Page";
  if (previewUrlEl) previewUrlEl.textContent = hostname;
  if (linkTextEl) linkTextEl.textContent = hostname;
  if (linkPreview) linkPreview.href = url;

  // Set favicon immediately
  if (faviconEl) {
    faviconEl.src = `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
    faviconEl.onerror = () => {
      if (faviconEl) faviconEl.style.display = 'none';
    };
  }

  // Set "Save" Link (Deep Link)
  const saveUrl = `${API_BASE}/save?url=${encodeURIComponent(url)}`;
  
  if (saveLinkBtn) {
    saveLinkBtn.href = saveUrl;
    saveLinkBtn.addEventListener('click', (e) => {
      setTimeout(() => {
        try {
          window.close();
        } catch (err) {
          // Some browsers don't allow programmatic close
        }
      }, 200);
    });
  }

  // Fetch Enhanced Metadata
  fetchMetadata(url);
}

function showFileDetails(type) {
  hideAll();
  fileDetailsEl.style.display = 'block';
  
  // Update title and file types hint
  if (type === 'image') {
    if (fileStepTitle) fileStepTitle.textContent = 'Image Details';
    if (fileTypesHint) fileTypesHint.textContent = 'Supported: JPG, PNG, GIF, WebP';
    if (fileInput) fileInput.accept = 'image/*';
    
    // Show method toggle for images
    if (imageMethodToggle) imageMethodToggle.style.display = 'flex';
    if (imageUrlSection) imageUrlSection.style.display = 'none';
    if (dropZone) dropZone.style.display = 'block';
    
    // Setup toggle buttons
    setupImageMethodToggle();
  } else if (type === 'docs') {
    if (fileStepTitle) fileStepTitle.textContent = 'Document Details';
    if (fileTypesHint) fileTypesHint.textContent = 'Supported: PDF, DOC, DOCX, TXT';
    if (fileInput) fileInput.accept = '.pdf,.doc,.docx,.txt';
    
    // Hide method toggle for docs
    if (imageMethodToggle) imageMethodToggle.style.display = 'none';
    if (imageUrlSection) imageUrlSection.style.display = 'none';
    if (dropZone) dropZone.style.display = 'block';
  }

  // Setup file input
  setupFileUpload(type);
}

function setupFileUpload(type) {
  // Browse button - separate from drop zone to prevent accidental clicks
  if (browseFileBtn) {
    browseFileBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (fileInput) {
        fileInput.click();
      }
    });
  }

  // Remove click handler from drop content - only drag-and-drop works there
  // This prevents accidental clicks that might close the popup

  // File input change
  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const file = e.target.files?.[0];
      if (file) {
        // Save file data to storage before popup might close
        const reader = new FileReader();
        reader.onloadend = async () => {
          const fileData = {
            name: file.name,
            type: file.type,
            size: file.size,
            data: reader.result,
            cardType: type,
            timestamp: Date.now()
          };
          
          // Save to chrome storage in case popup closes
          try {
            await chrome.storage.local.set({ pendingFile: fileData });
          } catch (err) {
            console.log('Storage not available:', err);
          }
          
          handleFileSelect(file, type);
        };
        
        if (type === 'image') {
          reader.readAsDataURL(file);
        } else {
          // For docs, we'll handle it differently
          reader.readAsDataURL(file);
        }
      }
    });
  }

  // Drag and drop - this works without closing the popup
  if (dropZone) {
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('dragging');
    });

    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('dragging');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('dragging');

      const file = e.dataTransfer.files?.[0];
      if (file) {
        handleFileSelect(file, type);
      }
    });
  }

  // Remove file
  if (removeFileBtn) {
    removeFileBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      selectedFile = null;
      filePreview = null;
      if (fileInput) fileInput.value = '';
      if (fileTitleInput) fileTitleInput.value = '';
      if (fileDescriptionInput) fileDescriptionInput.value = '';
      updateFilePreview();
      if (saveFileBtn) saveFileBtn.style.display = 'none';
    });
  }

  // Title input change
  if (fileTitleInput) {
    fileTitleInput.addEventListener('input', () => {
      updateSaveButton();
    });
  }
}

// Track if toggle listeners are already set up
let toggleListenersSetup = false;

function setupImageMethodToggle() {
  // Toggle between file upload and URL input
  // Only set up if elements exist and not already set up
  if (!toggleFileBtn || !toggleUrlBtn || toggleListenersSetup) {
    return;
  }
  
  toggleListenersSetup = true;
  
  // Toggle to file upload
  toggleFileBtn.addEventListener('click', () => {
    toggleFileBtn.classList.add('active');
    toggleUrlBtn.classList.remove('active');
    if (dropZone) dropZone.style.display = 'block';
    if (imageUrlSection) imageUrlSection.style.display = 'none';
    // Clear URL input
    if (imageUrlInput) imageUrlInput.value = '';
    if (imageUrlPreview) imageUrlPreview.style.display = 'none';
    selectedFile = null;
    filePreview = null;
    updateSaveButton();
  });

  // Toggle to URL input
  toggleUrlBtn.addEventListener('click', () => {
    toggleUrlBtn.classList.add('active');
    toggleFileBtn.classList.remove('active');
    if (dropZone) dropZone.style.display = 'none';
    if (imageUrlSection) imageUrlSection.style.display = 'block';
    // Clear file input
    if (fileInput) fileInput.value = '';
    selectedFile = null;
    filePreview = null;
    if (filePreviewEl) filePreviewEl.style.display = 'none';
    if (dropContent) dropContent.style.display = 'flex';
    updateSaveButton();
  });

  // Image URL input handler
  if (imageUrlInput) {
    imageUrlInput.addEventListener('input', async (e) => {
      const url = e.target.value.trim();
      if (!url) {
        if (imageUrlPreview) imageUrlPreview.style.display = 'none';
        updateSaveButton();
        return;
      }

      // Validate URL
      try {
        new URL(url);
        // Show preview
        if (imageUrlPreviewImg) {
          imageUrlPreviewImg.src = url;
          imageUrlPreviewImg.onerror = () => {
            if (imageUrlPreview) imageUrlPreview.style.display = 'none';
            showError('Invalid image URL or image cannot be loaded');
          };
          imageUrlPreviewImg.onload = () => {
            if (imageUrlPreview) imageUrlPreview.style.display = 'block';
          };
        }
        updateSaveButton();
      } catch (err) {
        if (imageUrlPreview) imageUrlPreview.style.display = 'none';
        updateSaveButton();
      }
    });
  }

  // Remove URL button
  if (removeUrlBtn) {
    removeUrlBtn.addEventListener('click', () => {
      if (imageUrlInput) imageUrlInput.value = '';
      if (imageUrlPreview) imageUrlPreview.style.display = 'none';
      updateSaveButton();
    });
  }
}

function handleFileSelect(file, type) {
  // Validate file type
  if (type === 'image') {
    if (!file.type.startsWith('image/')) {
      showError('Please select an image file');
      return;
    }
  } else if (type === 'docs') {
    const allowedTypes = ['.pdf', '.doc', '.docx', '.txt'];
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowedTypes.includes(fileExt)) {
      showError('Please select a valid document file (PDF, DOC, DOCX, or TXT)');
      return;
    }
  }

  selectedFile = file;
  
  // Create preview
  if (type === 'image') {
    const reader = new FileReader();
    reader.onloadend = () => {
      filePreview = reader.result;
      updateFilePreview();
    };
    reader.readAsDataURL(file);
  } else {
    filePreview = null;
    updateFilePreview();
  }

  // Auto-fill title if empty
  if (fileTitleInput && !fileTitleInput.value) {
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
    fileTitleInput.value = nameWithoutExt;
  }

  updateSaveButton();
}

function updateFilePreview() {
  if (!selectedFile) {
    if (dropContent) dropContent.style.display = 'flex';
    if (filePreviewEl) filePreviewEl.style.display = 'none';
    return;
  }

  if (dropContent) dropContent.style.display = 'none';
  if (filePreviewEl) filePreviewEl.style.display = 'block';

  if (filePreviewContent) {
    if (filePreview) {
      // Image preview
      filePreviewContent.innerHTML = `
        <img src="${filePreview}" alt="Preview" style="width: 48px; height: 48px; object-fit: cover; border-radius: 6px;" />
        <div class="file-preview-info">
          <p class="file-preview-name">${selectedFile.name}</p>
          <p class="file-preview-size">${formatFileSize(selectedFile.size)}</p>
        </div>
      `;
    } else {
      // Document preview
      filePreviewContent.innerHTML = `
        <div class="file-preview-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div class="file-preview-info">
          <p class="file-preview-name">${selectedFile.name}</p>
          <p class="file-preview-size">${formatFileSize(selectedFile.size)}</p>
        </div>
      `;
    }
  }
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

async function updateSaveButton() {
  if (!fileTitleInput || !fileTitleInput.value.trim()) {
    if (saveFileBtn) saveFileBtn.style.display = 'none';
    return;
  }

  // Check if using file upload or URL
  const isUsingUrl = toggleUrlBtn && toggleUrlBtn.classList.contains('active');
  const imageUrl = isUsingUrl && imageUrlInput ? imageUrlInput.value.trim() : null;

  if (!selectedFile && !imageUrl) {
    if (saveFileBtn) saveFileBtn.style.display = 'none';
    return;
  }

  if (saveFileBtn) {
    saveFileBtn.style.display = 'flex';
    
    let fileData;
    
    if (isUsingUrl && imageUrl) {
      // Using image URL
      fileData = {
        cardType: selectedCardType,
        title: fileTitleInput.value.trim(),
        description: fileDescriptionInput.value.trim() || undefined,
        imageUrl: imageUrl,
      };
      
      // Encode and set href immediately for URL
      const encodedData = encodeURIComponent(JSON.stringify(fileData));
      const saveUrl = `${API_BASE}/save?file=${encodedData}`;
      saveFileBtn.href = saveUrl;
    } else if (selectedFile) {
      // Using file upload
      const reader = new FileReader();
      reader.onloadend = async () => {
        const fileDataUrl = reader.result;
        const fileData = {
          name: selectedFile.name,
          type: selectedFile.type,
          size: selectedFile.size,
          data: fileDataUrl,
          cardType: selectedCardType,
          title: fileTitleInput.value.trim(),
          description: fileDescriptionInput.value.trim() || undefined,
        };
        
        // Save to chrome storage as backup
        try {
          await chrome.storage.local.set({ pendingFileData: fileData });
        } catch (err) {
          console.log('Storage error:', err);
        }
        
        // Encode file data in URL
        const encodedData = encodeURIComponent(JSON.stringify(fileData));
        const saveUrl = `${API_BASE}/save?file=${encodedData}`;
        saveFileBtn.href = saveUrl;
      };
      
      reader.readAsDataURL(selectedFile);
      return; // Exit early, will set href in onloadend
    } else {
      if (saveFileBtn) saveFileBtn.style.display = 'none';
      return;
    }
  }
}

// Back button handlers
if (backBtnLink) {
  backBtnLink.addEventListener('click', () => {
    showTypeSelection();
  });
}

if (backBtnFile) {
  backBtnFile.addEventListener('click', () => {
    showTypeSelection();
    selectedFile = null;
    filePreview = null;
    if (fileInput) fileInput.value = '';
    if (fileTitleInput) fileTitleInput.value = '';
    if (fileDescriptionInput) fileDescriptionInput.value = '';
    updateFilePreview();
  });
}

async function fetchMetadata(url) {
  try {
    // First try the cache endpoint (faster)
    const cacheResponse = await fetch(`${API_BASE}/api/metadata?url=${encodeURIComponent(url)}`);
    
    if (cacheResponse.ok) {
      const cacheData = await cacheResponse.json();
      if (cacheData.ok && cacheData.found && cacheData.meta) {
        updatePreview(cacheData.meta);
        return;
      }
    }

    // If not in cache, fetch metadata directly
    const queueResponse = await fetch(`${API_BASE}/api/metadata`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
    });

    if (queueResponse.ok) {
      const queueData = await queueResponse.json();
      if (queueData.ok && queueData.meta) {
        updatePreview(queueData.meta);
      }
    }
  } catch (err) {
    // Silently fail - we already have tab title/URL as fallback
    console.log("Metadata fetch failed, using tab data:", err);
  }
}

function updatePreview(meta) {
  if (!meta) return;

  if (meta.title && meta.title.trim() && previewTitleEl) {
    previewTitleEl.textContent = meta.title;
  }

  if (meta.description && meta.description.trim() && previewDescriptionEl) {
    previewDescriptionEl.textContent = meta.description;
    previewDescriptionEl.style.display = 'block';
  }

  if (meta.image && previewImageEl && previewImageContainer) {
    previewImageEl.src = meta.image;
    previewImageEl.onerror = () => {
      if (previewImageContainer) previewImageContainer.style.display = 'none';
    };
    previewImageEl.onload = () => {
      if (previewImageContainer) previewImageContainer.style.display = 'block';
    };
  }
}

function showError(message) {
  if (loadingEl) loadingEl.style.display = 'none';
  if (errorTextEl) errorTextEl.textContent = message;
  if (errorEl) errorEl.style.display = 'flex';
  hideAll();
}

function hideAll() {
  if (typeSelectionEl) typeSelectionEl.style.display = 'none';
  if (linkDetailsEl) linkDetailsEl.style.display = 'none';
  if (fileDetailsEl) fileDetailsEl.style.display = 'none';
}

// Handle keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    try {
      window.close();
    } catch (err) {
      // Some browsers don't allow programmatic close
    }
  }
});
