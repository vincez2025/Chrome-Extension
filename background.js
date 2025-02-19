chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension installed. Attempting to inject sidebar into the active tab.");
  
    // Query the current active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]) {
        const tabId = tabs[0].id;
        const url = tabs[0].url;
        console.log("Active tab found, tab id:", tabId);
  
        // Check if the URL is injectable
        if (isPermittedURL(url)) {
          // Execute the content script to inject the sidebar
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
          }).then(() => {
            console.log("Sidebar injection script executed successfully.");
          }).catch((err) => {
            console.error("Injection error:", err);
          });
        } else {
          console.log("Cannot inject into this page type:", url);
        }
      } else {
        console.warn("No active tab found. Sidebar injection aborted.");
      }
    });
  });
  
  // Helper function to check if URL is permitted for injection
  function isPermittedURL(url) {
    if (!url) return false;
    
    return !url.startsWith('chrome://') && 
           !url.startsWith('chrome-extension://') &&
           !url.startsWith('chrome-search://') &&
           !url.startsWith('chrome-settings://') &&
           !url.startsWith('about:') &&
           !url.startsWith('edge://') &&
           !url.startsWith('brave://');
  }
  
  // This function will be executed in the context of the webpage.
  function injectSidebar() {
    try {
      // Prevent duplicate sidebars
      if (document.getElementById('my-extension-sidebar')) {
        console.log("Sidebar already exists. Skipping injection.");
        return;
      }
  
      // Create a container for the sidebar
      const sidebar = document.createElement('div');
      sidebar.id = 'my-extension-sidebar';
      // Inline styling for demo purposes
      Object.assign(sidebar.style, {
        position: 'fixed',
        top: '0',
        right: '0',
        width: '300px',
        height: '100%',
        backgroundColor: '#fff',
        boxShadow: '-2px 0 5px rgba(0,0,0,0.3)',
        zIndex: '9999',
        overflowY: 'auto',
        padding: '10px'
      });
  
      // Insert content into the sidebar
      sidebar.innerHTML = `
        <h1>My Sidebar</h1>
        <button id="close-sidebar">Close Sidebar</button>
        <div id="sidebar-content">This is your sidebar content.</div>
      `;
  
      // Append the sidebar to the body
      document.body.appendChild(sidebar);
  
      // Add functionality to close the sidebar
      document.getElementById('close-sidebar').addEventListener('click', () => {
        sidebar.remove();
      });
      console.log("Sidebar injected.");
    } catch (error) {
      console.error("Error in injectSidebar:", error);
    }
  }
  