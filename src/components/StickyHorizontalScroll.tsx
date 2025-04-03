import React, { useRef, useEffect } from "react";

interface StickyHorizontalScrollProps {
    children: React.ReactNode;
    className?: string;
}

const StickyHorizontalScroll: React.FC<StickyHorizontalScrollProps> = ({ children, className = "" }) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const scrollbarRef = useRef<HTMLDivElement>(null);
    const innerScrollbarRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const scrollContainer = scrollContainerRef.current;
        const scrollbar = scrollbarRef.current;
        const innerScrollbar = innerScrollbarRef.current;
        if (!scrollContainer || !scrollbar || !innerScrollbar) return;

        // Set the inner scrollbar width to match the scroll container's scroll width.
        innerScrollbar.style.width = `${scrollContainer.scrollWidth}px`;

        // Sync scroll positions: when the content scrolls, update the fake scrollbar.
        const handleContentScroll = () => {
            scrollbar.scrollLeft = scrollContainer.scrollLeft;
        };

        // And vice versa.
        const handleScrollbarScroll = () => {
            scrollContainer.scrollLeft = scrollbar.scrollLeft;
        };

        scrollContainer.addEventListener("scroll", handleContentScroll);
        scrollbar.addEventListener("scroll", handleScrollbarScroll);

        // Update inner scrollbar width on window resize.
        const handleResize = () => {
            innerScrollbar.style.width = `${scrollContainer.scrollWidth}px`;
        };

        window.addEventListener("resize", handleResize);

        return () => {
            scrollContainer.removeEventListener("scroll", handleContentScroll);
            scrollbar.removeEventListener("scroll", handleScrollbarScroll);
            window.removeEventListener("resize", handleResize);
        };
    }, [children]);

    return (
        <div className={`relative ${className}`}>
            {/* Scrollable content container */}
            <div ref={scrollContainerRef} style={{ overflowX: "auto" }}>
                {children}
            </div>
            {/* Sticky fake scrollbar */}
            <div
                ref={scrollbarRef}
                style={{
                    overflowX: "auto",
                    position: "sticky",
                    bottom: 0,
                    background: "#fff", // Change as needed or use a Tailwind class
                    borderTop: "1px solid #ccc",
                    height: "20px", // Height to mimic the scrollbar area
                }}
            >
                <div ref={innerScrollbarRef} style={{ height: "1px" }} />
            </div>
        </div>
    );
};

export default StickyHorizontalScroll;