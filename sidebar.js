class SidebarManager {
    constructor() {
      this.outputElement = document.getElementById('output');
      this.init();
    }
  
    init() {
      console.log('Sidebar initialized');
      document.getElementById('myButton').addEventListener('click', () => {
        this.handleClick();
      });
    }
  
    handleClick() {
      const message = 'Button clicked in sidebar!';
      console.log(message);
      this.outputElement.textContent = message;
    }
  }
  
  // Initialize the sidebar once the DOM is fully loaded
  document.addEventListener('DOMContentLoaded', () => {
    new SidebarManager();
  });
  