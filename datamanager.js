class DataManager {
    constructor() {
        if (DataManager.instance) {
            return DataManager.instance;
        }
        this.initializationAttempts = 0;
        this.maxAttempts = 30;
        this.retryInterval = 1000;
        this.isInitialized = false;
        this.onInitializedCallbacks = [];
        this.observer = null;
        this.chatContainer = null;
        this.isPanel = window.location.protocol === 'chrome-extension:';
        
        DataManager.instance = this;
    }

    async init() {
        try {
            await this.waitForPageLoad();
            const container = await this.waitForChatContainer();
            this.initialize(container);
            this.setupDebugButton();
        } catch (error) {
            console.error('DataManager initialization failed:', error);
        }
    }

    setupDebugButton() {
        if (this.isPanel) return; // Don't add debug button in panel

        this.debugButton = document.createElement('button');
        this.debugButton.textContent = 'DataManager Debug';
        Object.assign(this.debugButton.style, {
            position: 'fixed',
            bottom: '60px',
            right: '20px',
            padding: '10px 20px',
            backgroundColor: '#10a37f',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            zIndex: '10000'
        });

        this.debugButton.addEventListener('click', () => {
            const info = `
                ChatGPT Page Debug Info:
                Current URL: ${window.location.href}
                Is ChatGPT: Yes
                DataManager Ready: ${this.isInitialized ? 'Yes' : 'No'}
                Chat Container Found: ${!!this.chatContainer ? 'Yes' : 'No'}
                Observer Active: ${!!this.observer ? 'Yes' : 'No'}
            `;
            alert(info);
        });

        document.body.appendChild(this.debugButton);
    }

    waitForPageLoad() {
        return new Promise(resolve => {
            if (document.readyState === 'complete') {
                resolve();
            } else {
                window.addEventListener('load', resolve, { once: true });
            }
        });
    }

    findChatContainer() {
        // First try to find any conversation turns
        const turns = document.querySelectorAll('[data-testid*="conversation-turn"]');
        if (turns.length > 0) {
            // Get the first turn and find its closest conversation container
            const firstTurn = turns[0];
            // Log the turn for debugging
            console.log("Found turn:", firstTurn);
            
            // Try to find a parent that looks like a conversation container
            const container = firstTurn.closest('main') || // Try main element first
                            firstTurn.closest('[class*="conversation"]') || // Then try conversation class
                            firstTurn.closest('[class*="chat"]') || // Then try chat class
                            firstTurn.parentElement; // Fallback to direct parent
            
            if (container) {
                console.log("Found container:", container);
                return container;
            }
        }

        // Fallback to looking for specific container types
        const containerSelectors = [
            'main',
            '[class*="conversation"]',
            '[class*="chat"]',
            '[class*="messages"]',
            '[class*="thread"]'
        ];

        for (const selector of containerSelectors) {
            const container = document.querySelector(selector);
            if (container && container.querySelector('[data-testid*="conversation-turn"]')) {
                console.log("Found container via selector:", selector);
                return container;
            }
        }

        // If still not found, find the closest common ancestor of all turns
        if (turns.length > 0) {
            const parents = [];
            let currentParent = turns[0].parentElement;
            
            while (currentParent && currentParent !== document.body) {
                parents.push(currentParent);
                currentParent = currentParent.parentElement;
            }

            // Find the first parent that contains all turns
            for (const parent of parents) {
                if (Array.from(turns).every(turn => parent.contains(turn))) {
                    console.log("Found container via common ancestor");
                    return parent;
                }
            }
        }

        console.log("No container found");
        return null;
    }

    waitForChatContainer() {
        return new Promise((resolve, reject) => {
            const checkContainer = () => {
                if (document.readyState !== 'complete') {
                    setTimeout(checkContainer, this.retryInterval);
                    return;
                }

                console.log("Checking for chat container...");
                
                const chatContainer = this.findChatContainer();
                
                if (chatContainer) {
                    console.log("Chat container found!", chatContainer);
                    resolve(chatContainer);
                } else {
                    this.initializationAttempts++;
                    if (this.initializationAttempts < this.maxAttempts) {
                        console.warn(`Chat container not found. Retrying (${this.initializationAttempts}/${this.maxAttempts})...`);
                        setTimeout(checkContainer, this.retryInterval);
                    } else {
                        reject(new Error("Chat container could not be found after maximum retries."));
                    }
                }
            };
            
            checkContainer();
        });
    }

    onInitialized(callback) {
        if (this.isInitialized) {
            callback();
        } else {
            this.onInitializedCallbacks.push(callback);
        }
    }

    initialize(chatContainer) {
        if (this.isInitialized) return;
        
        console.log("Initializing DataManager...");
        this.chatContainer = chatContainer;
        
        try {
            this.setupObserver();
            this.isInitialized = true;
            
            // Call all registered callbacks
            this.onInitializedCallbacks.forEach(callback => callback());
            this.onInitializedCallbacks = [];
            
            window.dispatchEvent(new CustomEvent('dataManagerReady'));
        } catch (error) {
            console.error('Error during initialization:', error);
        }
    }

    setupObserver() {
        if (this.observer) {
            this.observer.disconnect();
        }

        if (!this.chatContainer) {
            console.warn("Chat container not found for observer.");
            return;
        }

        // Create a mutation observer to watch for changes
        this.observer = new MutationObserver(this.debounce(() => {
            console.log("Chat content changed");
        }, 1000));

        this.observer.observe(this.chatContainer, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// Create and initialize instance
let dataManagerInstance = null;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        dataManagerInstance = new DataManager();
        if (!dataManagerInstance.isPanel) {
            dataManagerInstance.init();
        }
    });
} else {
    dataManagerInstance = new DataManager();
    if (!dataManagerInstance.isPanel) {
        dataManagerInstance.init();
    }
}

export default dataManagerInstance;
