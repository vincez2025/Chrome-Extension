(function() {
    class ChatNavigator {
        constructor() {
            this.initializationAttempts = 0;
            this.maxAttempts = 30;
            this.retryInterval = 1000;
            this.isInitialized = false;
            this.onInitializedCallbacks = [];
            
            // Ensure styles are loaded
            if (!document.querySelector('link[href*="styles.css"]')) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.type = 'text/css';
                link.href = chrome.runtime.getURL('styles.css');
                document.head.appendChild(link);
            }
            
            // Start initialization process
            this.init().catch(error => {
                console.error('Initialization error:', error);
            });
        }

        async init() {
            try {
                await this.waitForPageLoad();
                await this.waitForChatContainer();
            } catch (error) {
                console.error('ChatNavigator initialization failed:', error);
            }
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
                    // First check if page is ready
                    if (document.readyState !== 'complete') {
                        setTimeout(checkContainer, this.retryInterval);
                        return;
                    }
    
                    console.log("Checking for chat container...");
                    
                    const chatContainer = this.findChatContainer();
                    
                    if (chatContainer) {
                        console.log("Chat container found!", chatContainer);
                        this.initialize(chatContainer);
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
                
                // Start checking
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
            
            console.log("Initializing ChatNavigator...");
            this.chatContainer = chatContainer;
            
            try {
                this.createMessageList();
                this.setupObserver();
                
                this.isInitialized = true;
                
                // Call all registered callbacks
                this.onInitializedCallbacks.forEach(callback => callback());
                this.onInitializedCallbacks = [];
            } catch (error) {
                console.error('Error during initialization:', error);
            }
        }

        createMessageList() {
            let listContainer = document.querySelector('.message-list-container');
            if (!listContainer) {
                listContainer = document.createElement('div');
                listContainer.className = 'message-list-container';
                Object.assign(listContainer.style, {
                    position: 'fixed',
                    right: '20px',
                    top: '20px',
                    maxHeight: '60vh',
                    width: '250px',
                    overflowY: 'auto',
                    backgroundColor: '#f5f5f5',
                    padding: '10px',
                    boxShadow: '-2px 0 5px rgba(0,0,0,0.1)',
                    zIndex: '10000',
                    borderRadius: '8px',
                });
                document.body.appendChild(listContainer);
            }

            listContainer.innerHTML = '';
            const messageList = document.createElement('div');
            messageList.className = 'message-list';

            this.ensureStyles();

            const messages = Array.from(document.querySelectorAll('[data-testid*="conversation-turn"]'))
                .map(turn => {
                    // Try multiple selectors to find message content
                    const messageContent = 
                        turn.querySelector('div[class*="text-base"]') ||
                        turn.querySelector('[class*="content"]') ||
                        turn.querySelector('[class*="message"]') ||
                        turn.querySelector('p') ||
                        turn.querySelector('div:not([class*="avatar"])'); // Exclude avatar divs
                        
                    if (!messageContent) {
                        console.warn('Could not find message content in turn:', turn);
                        return null;
                    }

                    // Get text content safely
                    let textContent = '';
                    try {
                        // Remove code blocks and other non-text elements before getting content
                        const clonedContent = messageContent.cloneNode(true);
                        const codeBlocks = clonedContent.querySelectorAll('pre, code');
                        codeBlocks.forEach(block => block.remove());
                        
                        textContent = clonedContent.textContent.trim();
                        if (!textContent) {
                            console.warn('Empty message content found');
                            return null;
                        }
                    } catch (error) {
                        console.error('Error extracting message text:', error);
                        return null;
                    }

                    return { 
                        element: messageContent, 
                        isHuman: turn.getAttribute('data-testid').includes('human'),
                        text: textContent
                    };
                })
                .filter(Boolean);

            if (messages.length > 0) {
                // Only initialize FoldPage if we haven't already
                if (!window.foldPageInstance && typeof FoldPage !== 'undefined') {
                    window.foldPageInstance = new FoldPage();
                    window.foldPageInstance.initialize(messages);
                } else if (window.foldPageInstance) {
                    // If FoldPage exists, just update with new messages
                    window.foldPageInstance.initialize(messages);
                }

                messages.forEach(({ element, isHuman, text }, index) => {
                    const button = document.createElement('button');
                    button.className = `message-button ${isHuman ? 'human-message' : 'ai-message'}`;
                    
                    // Add current-question class only if this is a human message
                    // and matches the current question index
                    if (isHuman && index/2 === window.currentQuestionIndex) {
                        button.classList.add('current-question');
                    }
                    
                    // Add icon span
                    const iconSpan = document.createElement('span');
                    iconSpan.className = 'message-icon';
                    iconSpan.innerHTML = isHuman ? '👤' : '🤖';
                    
                    // Create text span
                    const textSpan = document.createElement('span');
                    const preview = text.length > 30 ? text.substring(0, 30) + '...' : text;
                    textSpan.textContent = `${index + 1}. ${isHuman ? 'You: ' : 'AI: '}${preview}`;
                    
                    button.appendChild(iconSpan);
                    button.appendChild(textSpan);
                    button.title = text;

                    button.addEventListener('click', () => {
                        if (isHuman) {
                            // Update current question index only for human messages
                            // Divide by 2 since we want to count question pairs
                            window.currentQuestionIndex = Math.floor(index/2);
                            
                            // Remove highlighting from all buttons
                            document.querySelectorAll('.message-button').forEach(btn => {
                                btn.classList.remove('current-question');
                            });
                            
                            // Add highlighting to clicked button
                            button.classList.add('current-question');
                            
                            // Dispatch event for the change
                            window.dispatchEvent(new CustomEvent('currentQuestionChanged', {
                                detail: { 
                                    index: window.currentQuestionIndex,
                                    isHuman: true 
                                }
                            }));
                        }
                        
                        // Scroll to the message
                        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        
                        // Add visual feedback to the message in the chat
                        const messageContainer = element.closest('[data-testid*="conversation-turn"]');
                        if (messageContainer) {
                            // Remove highlight from all messages
                            document.querySelectorAll('[data-testid*="conversation-turn"]').forEach(msg => {
                                msg.style.backgroundColor = '';
                            });
                            
                            // Add highlight to current message
                            messageContainer.style.backgroundColor = '#f0f8ff';
                            setTimeout(() => {
                                messageContainer.style.backgroundColor = '';
                            }, 1000);
                        }
                    });

                    messageList.appendChild(button);
                });

                // Also update the setupObserver method to maintain highlighting
                this.setupObserver();
            } else {
                const placeholder = document.createElement('div');
                placeholder.textContent = 'No messages found. If you see messages, please refresh the page.';
                placeholder.style.padding = '10px';
                placeholder.style.color = '#666';
                messageList.appendChild(placeholder);
            }

            listContainer.appendChild(messageList);
        }

        ensureStyles() {
            // Remove this entire function as styles should be in styles.css
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
            this.observer = new MutationObserver(debounce(() => {
                // Store current index before recreating list
                const currentIndex = window.currentQuestionIndex;
                
                // Recreate message list
                this.createMessageList();
                
                // Restore highlighting after list recreation
                if (currentIndex !== undefined && currentIndex !== -1) {
                    const buttons = document.querySelectorAll('.message-button');
                    if (buttons[currentIndex]) {
                        buttons[currentIndex].classList.add('current-question');
                    }
                }
            }, 1000));

            this.observer.observe(this.chatContainer, {
                childList: true,
                subtree: true,
                characterData: true
            });
        }
    }

    // Debounce helper function
    function debounce(func, wait) {
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

    // Modify the initialization section at the bottom
    let chatNavigatorInitialized = false;

    function initializeNavigator() {
        if (chatNavigatorInitialized) {
            console.log("ChatNavigator already initialized");
            return;
        }
        
        try {
            // Load FoldPage script first if not already loaded
            const script = document.createElement('script');
            script.src = chrome.runtime.getURL('fold_page.js');
            script.onload = () => {
                console.log("FoldPage script loaded");
                chatNavigatorInitialized = true;
                const chatNavigatorInstance = new ChatNavigator();
                
                chatNavigatorInstance.onInitialized(() => {
                    console.log("ChatNavigator fully initialized");
                    if (!window.foldPageInstance && typeof FoldPage !== 'undefined') {
                        console.log("Initializing FoldPage...");
                        window.foldPageInstance = new FoldPage();
                    }
                });
            };
            script.onerror = (error) => {
                console.error('Error loading FoldPage script:', error);
                // Continue with ChatNavigator initialization even if FoldPage fails to load
                chatNavigatorInitialized = true;
                const chatNavigatorInstance = new ChatNavigator();
            };
            document.head.appendChild(script);
        } catch (error) {
            console.error('Error initializing ChatNavigator:', error);
            chatNavigatorInitialized = false;
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeNavigator);
    } else {
        initializeNavigator();
    }

    function scrollToQuestion(element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function handleNavigation(direction) {
        // ... existing code for finding current and next elements ...
        
        if (nextElement) {
            currentElement.classList.remove('active');
            nextElement.classList.add('active');
            scrollToQuestion(nextElement);
        }
        // ... existing code ...
    }

    // Update the event listener at the bottom of the file
    window.addEventListener('currentQuestionChanged', (event) => {
        const { index, isHuman } = event.detail;
        const buttons = document.querySelectorAll('.message-button.human-message');
        
        buttons.forEach((btn, i) => {
            // Only highlight human messages (questions)
            if (Math.floor(i/2) === index) {
                btn.classList.add('current-question');
            } else {
                btn.classList.remove('current-question');
            }
        });
    });
})();