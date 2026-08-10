/**
 * ============================================
 * BARRIGUDA WEB TV - APLICAÇÃO PRINCIPAL
 * ============================================
 * Arquitetura: Programação Orientada a Objetos
 * Padrões de Projeto: 
 *   - Singleton (App, ToastService)
 *   - Observer (NavigationManager)
 *   - Strategy (Validação de formulário)
 *   - MVC (Model-View-Controller simplificado)
 * 
 * Princípios IHC (Interação Humano-Computador):
 *   - Feedback imediato
 *   - Consistência visual
 *   - Prevenção de erros
 *   - Acessibilidade (ARIA, skip links, focus management)
 *   - Redução de carga cognitiva
 * ============================================
 */

/**
 * Classe Singleton para exibir notificações toast
 * @implements {Singleton Pattern}
 */
class ToastService {
    constructor() {
        if (ToastService.instance) {
            return ToastService.instance;
        }
        this.container = document.getElementById('toast-container');
        ToastService.instance = this;
    }

    /**
     * Exibe uma notificação toast
     * @param {string} message - Mensagem a ser exibida
     * @param {string} type - Tipo: 'success' | 'error' | 'info'
     * @param {number} duration - Duração em ms
     */
    show(message, type = 'success', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'polite');

        const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
        toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;

        this.container.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, duration + 300);
    }
}

/**
 * Classe Observer para gerenciamento de navegação SPA
 * @implements {Observer Pattern}
 */
class NavigationManager {
    constructor() {
        this.currentSection = 'home';
        this.observers = [];
        this.navToggle = document.getElementById('nav-toggle');
        this.navMenu = document.getElementById('nav-menu');
        this.navLinks = document.querySelectorAll('.nav-link');
        this.sections = document.querySelectorAll('.section');

        this.init();
    }

    init() {
        // Eventos de navegação
        this.navLinks.forEach(link => {
            link.addEventListener('click', (e) => this.handleNavClick(e));
        });

        // Menu mobile
        this.navToggle.addEventListener('click', () => this.toggleMobileMenu());

        // Scroll do header
        window.addEventListener('scroll', () => this.handleScroll());

        // Tecla Escape para fechar menu mobile
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.navMenu.classList.contains('open')) {
                this.closeMobileMenu();
            }
        });

        // Hash inicial
        const hash = window.location.hash.replace('#', '');
        if (hash && document.getElementById(hash)) {
            this.navigateTo(hash);
        }
    }

    handleNavClick(e) {
        e.preventDefault();
        const section = e.currentTarget.dataset.section;
        this.navigateTo(section);
        this.closeMobileMenu();
    }

    navigateTo(sectionId) {
        if (this.currentSection === sectionId) return;

        // Atualizar estado
        this.currentSection = sectionId;
        window.location.hash = sectionId;

        // Atualizar UI - esconder todas as seções
        this.sections.forEach(section => {
            section.classList.add('hidden');
        });

        // Mostrar seção alvo
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.classList.remove('hidden');
            targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        // Atualizar links ativos
        this.navLinks.forEach(link => {
            link.classList.toggle('active', link.dataset.section === sectionId);
        });

        // Notificar observers
        this.notifyObservers(sectionId);

        // Focar no título da seção para leitores de tela (IHC)
        const sectionTitle = targetSection?.querySelector('.section-title');
        if (sectionTitle) {
            sectionTitle.setAttribute('tabindex', '-1');
            sectionTitle.focus({ preventScroll: true });
        }
    }

    toggleMobileMenu() {
        const isOpen = this.navMenu.classList.toggle('open');
        this.navToggle.setAttribute('aria-expanded', isOpen);
        this.navToggle.setAttribute('aria-label', isOpen ? 'Fechar menu' : 'Abrir menu');
    }

    closeMobileMenu() {
        this.navMenu.classList.remove('open');
        this.navToggle.setAttribute('aria-expanded', 'false');
        this.navToggle.setAttribute('aria-label', 'Abrir menu');
    }

    handleScroll() {
        const header = document.getElementById('header');
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    }

    subscribe(observer) {
        this.observers.push(observer);
    }

    notifyObservers(sectionId) {
        this.observers.forEach(observer => {
            if (typeof observer.onSectionChange === 'function') {
                observer.onSectionChange(sectionId);
            }
        });
    }
}

/**
 * Classe para gerenciamento da galeria com lightbox
 * @implements {MVC Pattern - Controller}
 */
class GalleryController {
    constructor() {
        this.lightbox = document.getElementById('lightbox');
        this.lightboxImg = document.getElementById('lightbox-img');
        this.galleryItems = document.querySelectorAll('.gallery-item:not(.gallery-placeholder)');
        this.currentIndex = 0;
        this.images = [];

        this.init();
    }

    init() {
        // Coletar imagens
        this.galleryItems.forEach((item, index) => {
            const img = item.querySelector('img');
            if (img) {
                this.images.push({
                    src: img.src,
                    alt: img.alt,
                    element: item
                });
                item.addEventListener('click', () => this.open(index));
                item.setAttribute('role', 'button');
                item.setAttribute('tabindex', '0');
                item.setAttribute('aria-label', `Abrir imagem: ${img.alt}`);

                // Suporte a teclado (IHC)
                item.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        this.open(index);
                    }
                });
            }
        });

        // Eventos do lightbox
        document.querySelector('.lightbox-close').addEventListener('click', () => this.close());
        document.querySelector('.lightbox-prev').addEventListener('click', () => this.prev());
        document.querySelector('.lightbox-next').addEventListener('click', () => this.next());

        this.lightbox.addEventListener('click', (e) => {
            if (e.target === this.lightbox) this.close();
        });

        document.addEventListener('keydown', (e) => {
            if (!this.lightbox.classList.contains('active')) return;
            if (e.key === 'Escape') this.close();
            if (e.key === 'ArrowLeft') this.prev();
            if (e.key === 'ArrowRight') this.next();
        });
    }

    open(index) {
        this.currentIndex = index;
        this.updateImage();
        this.lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Trap focus dentro do lightbox (IHC)
        this.lightbox.querySelector('.lightbox-close').focus();
    }

    close() {
        this.lightbox.classList.remove('active');
        document.body.style.overflow = '';

        // Retornar foco ao item da galeria (IHC)
        if (this.images[this.currentIndex]) {
            this.images[this.currentIndex].element.focus();
        }
    }

    prev() {
        this.currentIndex = (this.currentIndex - 1 + this.images.length) % this.images.length;
        this.updateImage();
    }

    next() {
        this.currentIndex = (this.currentIndex + 1) % this.images.length;
        this.updateImage();
    }

    updateImage() {
        const image = this.images[this.currentIndex];
        this.lightboxImg.src = image.src;
        this.lightboxImg.alt = image.alt;
    }
}

/**
 * Classe para validação de formulário
 * @implements {Strategy Pattern}
 */
class FormValidator {
    constructor(formId) {
        this.form = document.getElementById(formId);
        this.toast = new ToastService();
        this.validators = {
            nome: (value) => {
                if (!value.trim()) return 'O nome é obrigatório';
                if (value.trim().length < 3) return 'O nome deve ter pelo menos 3 caracteres';
                return null;
            },
            email: (value) => {
                if (!value.trim()) return 'O e-mail é obrigatório';
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(value)) return 'Digite um e-mail válido';
                return null;
            },
            mensagem: (value) => {
                if (!value.trim()) return 'A mensagem é obrigatória';
                if (value.trim().length < 10) return 'A mensagem deve ter pelo menos 10 caracteres';
                return null;
            }
        };

        this.init();
    }

    init() {
        if (!this.form) return;

        this.form.addEventListener('submit', (e) => this.handleSubmit(e));

        // Validação em tempo real (IHC - prevenção de erros)
        const inputs = this.form.querySelectorAll('input, textarea');
        inputs.forEach(input => {
            input.addEventListener('blur', () => this.validateField(input));
            input.addEventListener('input', () => this.clearError(input));
        });
    }

    validateField(field) {
        const name = field.name;
        const value = field.value;
        const validator = this.validators[name];

        if (!validator) return true;

        const error = validator(value);
        const errorElement = document.getElementById(`error-${name}`);

        if (error) {
            field.classList.add('error');
            field.setAttribute('aria-invalid', 'true');
            if (errorElement) errorElement.textContent = error;
            return false;
        } else {
            field.classList.remove('error');
            field.setAttribute('aria-invalid', 'false');
            if (errorElement) errorElement.textContent = '';
            return true;
        }
    }

    clearError(field) {
        field.classList.remove('error');
        field.setAttribute('aria-invalid', 'false');
        const errorElement = document.getElementById(`error-${field.name}`);
        if (errorElement) errorElement.textContent = '';
    }

    handleSubmit(e) {
        e.preventDefault();

        const inputs = this.form.querySelectorAll('input[required], textarea[required]');
        let isValid = true;

        inputs.forEach(input => {
            if (!this.validateField(input)) {
                isValid = false;
            }
        });

        if (isValid) {
            // Simular envio
            const submitBtn = this.form.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
            submitBtn.disabled = true;

            setTimeout(() => {
                this.toast.show('Mensagem enviada com sucesso!', 'success');
                this.form.reset();
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }, 1500);
        } else {
            this.toast.show('Por favor, corrija os erros no formulário.', 'error');
            // Focar no primeiro campo com erro (IHC)
            const firstError = this.form.querySelector('.error');
            if (firstError) firstError.focus();
        }
    }
}

/**
 * Classe para animação de contadores
 */
class CounterAnimation {
    constructor() {
        this.counters = document.querySelectorAll('.stat-number[data-count]');
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.animate(entry.target);
                    this.observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });

        this.init();
    }

    init() {
        this.counters.forEach(counter => {
            this.observer.observe(counter);
        });
    }

    animate(element) {
        const target = parseInt(element.dataset.count);
        const duration = 2000;
        const start = performance.now();

        const update = (currentTime) => {
            const elapsed = currentTime - start;
            const progress = Math.min(elapsed / duration, 1);

            // Easing ease-out
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const current = Math.floor(easeOut * target);

            element.textContent = current.toLocaleString('pt-BR') + '+';

            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                element.textContent = target.toLocaleString('pt-BR') + '+';
            }
        };

        requestAnimationFrame(update);
    }
}

/**
 * Classe para botão scroll-to-top
 */
class ScrollToTop {
    constructor() {
        this.button = document.getElementById('scroll-top');
        this.init();
    }

    init() {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 500) {
                this.button.classList.add('visible');
            } else {
                this.button.classList.remove('visible');
            }
        });

        this.button.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
}

/**
 * Classe principal da aplicação (Singleton)
 * @implements {Facade Pattern}
 */
class App {
    constructor() {
        if (App.instance) {
            return App.instance;
        }
        App.instance = this;
    }

    init() {
        // Inicializar serviços
        this.toast = new ToastService();
        this.navigation = new NavigationManager();
        this.gallery = new GalleryController();
        this.formValidator = new FormValidator('contact-form');
        this.counterAnimation = new CounterAnimation();
        this.scrollToTop = new ScrollToTop();

        // Atualizar ano no footer
        document.getElementById('year').textContent = new Date().getFullYear();

        console.log('🌳 Barriguda Web TV - Aplicação inicializada com sucesso!');
    }
}

// Inicializar aplicação quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
});
