import React, { useRef, useEffect, useState } from "react";

interface StickyHorizontalScrollProps {
    children: React.ReactNode;
    className?: string;
}

const StickyHorizontalScroll: React.FC<StickyHorizontalScrollProps> = ({ children, className = "" }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const scrollbarTrackRef = useRef<HTMLDivElement>(null);
    const scrollbarThumbRef = useRef<HTMLDivElement>(null);
    
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);
    const [thumbWidth, setThumbWidth] = useState(0);
    const [isDarkMode, setIsDarkMode] = useState(false);

    // Detect dark mode
    useEffect(() => {
        const detectDarkMode = () => {
            const isDark = document.documentElement.classList.contains('dark');
            setIsDarkMode(isDark);
        };
        
        detectDarkMode();
        
        // Watch for theme changes
        const observer = new MutationObserver(detectDarkMode);
        observer.observe(document.documentElement, { 
            attributes: true,
            attributeFilter: ['class'] 
        });
        
        return () => observer.disconnect();
    }, []);

    // Initialize scrollbar and resize handling
    useEffect(() => {
        const content = contentRef.current;
        const scrollbarTrack = scrollbarTrackRef.current;
        const scrollbarThumb = scrollbarThumbRef.current;
        
        if (!content || !scrollbarTrack || !scrollbarThumb) return;
        
        // Update thumb size based on content
        const updateThumbSize = () => {
            const { clientWidth, scrollWidth } = content;
            const thumbSize = Math.max((clientWidth / scrollWidth) * clientWidth, 40);
            setThumbWidth(thumbSize);
            scrollbarThumb.style.width = `${thumbSize}px`;
        };
        
        // Update thumb position when content scrolls
        const updateThumbPosition = () => {
            if (!content || !scrollbarThumb) return;
            
            const { scrollLeft, scrollWidth, clientWidth } = content;
            const thumbPosition = (scrollLeft / (scrollWidth - clientWidth)) * 
                                (scrollbarTrack.clientWidth - scrollbarThumb.clientWidth);
            
            scrollbarThumb.style.transform = `translateX(${thumbPosition}px)`;
        };
        
        // Handle scroll event
        const handleScroll = () => {
            if (isDragging) return;
            updateThumbPosition();
        };
        
        // Handle resize event
        const handleResize = () => {
            updateThumbSize();
            updateThumbPosition();
        };
        
        // Initialize
        updateThumbSize();
        updateThumbPosition();
        
        // Setup event listeners
        content.addEventListener('scroll', handleScroll);
        window.addEventListener('resize', handleResize);
        
        // Cleanup
        return () => {
            content.removeEventListener('scroll', handleScroll);
            window.removeEventListener('resize', handleResize);
        };
    }, [isDragging, children]);

    // Handle thumb dragging
    useEffect(() => {
        const content = contentRef.current;
        const scrollbarThumb = scrollbarThumbRef.current;
        const scrollbarTrack = scrollbarTrackRef.current;
        
        if (!scrollbarThumb || !content || !scrollbarTrack) return;
        
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;
            
            e.preventDefault();
            
            const deltaX = e.clientX - startX;
            const trackWidth = scrollbarTrack.clientWidth;
            const thumbMaxTravel = trackWidth - thumbWidth;
            
            // Calculate new position constrained to track bounds
            let newLeft = scrollLeft + deltaX;
            newLeft = Math.max(0, Math.min(newLeft, thumbMaxTravel));
            
            // Calculate corresponding content scroll position
            const scrollRatio = newLeft / thumbMaxTravel;
            const newContentScrollLeft = scrollRatio * (content.scrollWidth - content.clientWidth);
            
            // Update content scroll position
            content.scrollLeft = newContentScrollLeft;
            
            // Update thumb position directly for smoother dragging
            scrollbarThumb.style.transform = `translateX(${newLeft}px)`;
        };
        
        const handleMouseUp = () => {
            setIsDragging(false);
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        };
        
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'grabbing';
        }
        
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, startX, scrollLeft, thumbWidth]);

    // Handle thumb mousedown
    const handleThumbMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        
        const scrollbarThumb = scrollbarThumbRef.current;
        if (!scrollbarThumb) return;
        
        // Get current transform translate X value
        const style = getComputedStyle(scrollbarThumb);
        const transform = style.transform;
        let currentTranslateX = 0;
        
        if (transform !== 'none') {
            const matrix = transform.match(/matrix\((.+)\)/);
            if (matrix) {
                const values = matrix[1].split(', ');
                currentTranslateX = parseFloat(values[4]);
            }
        }
        
        setIsDragging(true);
        setStartX(e.clientX);
        setScrollLeft(currentTranslateX);
    };

    // Handle track click (jump to position)
    const handleTrackClick = (e: React.MouseEvent) => {
        const scrollbarTrack = scrollbarTrackRef.current;
        const scrollbarThumb = scrollbarThumbRef.current;
        const content = contentRef.current;
        
        if (!scrollbarTrack || !scrollbarThumb || !content) return;
        
        // Don't do anything if clicking on the thumb
        if (e.target === scrollbarThumb) return;
        
        // Get click position relative to track
        const trackRect = scrollbarTrack.getBoundingClientRect();
        const clickPosition = e.clientX - trackRect.left;
        
        // Calculate thumb center position (minus half thumb width)
        const thumbCenterPosition = Math.max(0, Math.min(clickPosition - (thumbWidth / 2), 
                                             scrollbarTrack.clientWidth - thumbWidth));
        
        // Calculate ratio and apply to content
        const scrollRatio = thumbCenterPosition / (scrollbarTrack.clientWidth - thumbWidth);
        const newContentScrollLeft = scrollRatio * (content.scrollWidth - content.clientWidth);
        
        // Smoothly scroll to position
        content.scrollTo({
            left: newContentScrollLeft,
            behavior: 'smooth'
        });
    };

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            {/* Main content with scroll */}
            <div 
                ref={contentRef}
                className="overflow-x-auto scrollbar-hide"
                style={{ 
                    scrollbarWidth: 'none', 
                    msOverflowStyle: 'none'
                }}
            >
                {children}
            </div>
            
            {/* Custom scrollbar */}
            <div 
                ref={scrollbarTrackRef}
                onClick={handleTrackClick}
                className={`h-4 sticky bottom-0 left-0 right-0 ${isDarkMode ? 'bg-gray-800 border-t border-gray-700' : 'bg-white border-t border-gray-200'}`}
                style={{ 
                    zIndex: 40, 
                    cursor: 'pointer',
                }}
            >
                <div 
                    ref={scrollbarThumbRef}
                    onMouseDown={handleThumbMouseDown}
                    className={`absolute h-3 top-0.5 rounded-full ${isDarkMode ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-300 hover:bg-gray-400'}`}
                    style={{
                        cursor: isDragging ? 'grabbing' : 'grab',
                        transition: isDragging ? 'none' : 'background-color 0.2s',
                    }}
                ></div>
            </div>
            
            {/* Style for WebKit browsers to hide default scrollbar */}
            <style jsx>{`
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
            `}</style>
        </div>
    );
};

export default StickyHorizontalScroll;