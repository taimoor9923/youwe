(() => {
    // Function to split the SKU code into two halves
    const splitSku = (productSku) => {
        const halfLength = Math.ceil(productSku.length / 2);
        return [productSku.slice(0, halfLength), productSku.slice(halfLength)];
    };

    const priceFormatter = (price) => {
        const currentCurrency =  window.Shopify.currency.active;

        if (currentCurrency === 'USD' || currentCurrency === 'GBP') {
            const shopifyLocale = `${window.Shopify.locale}-${window.Shopify.country}`;
            const formattedPrice = parseFloat(price).toLocaleString(shopifyLocale, { style: 'currency', currency: currentCurrency });
            return formattedPrice;
        }

        return null
    };

    // Function to fetch results from the API using a SKU fragment
    const fetchResults = async (skuFragment, fullSku) => {
        const searchDomain = window.usf.settings.searchSvcUrl;
        const apiKey = window.usf.settings.siteId;

        // if apiKey not set, return null and check length of key is exactly 36 characters
        if (!apiKey || apiKey.length !== 36) {
            return null;
        }

        const maxResults = 24;
        const resultOverflow = 1; // we're removing the current SKU and possibly want to request more so we can allow for out of stock items
        const apiUrl = `${searchDomain}/instantsearch?q=${skuFragment}&apiKey=${apiKey}&showFacets=false&sort=bestselling&take=${maxResults + resultOverflow}`;

        const response = await fetch(apiUrl);
        const res = await response.json();

        const fragmentIndex = fullSku.toLowerCase().indexOf(skuFragment.toLowerCase());
     
        if (res.data && res.data.items) { // only return items that match the same SKU fragment in the correct position and also remove current item from results
            res.data.items = res.data.items.filter((item) => {
                return !item.variants.some((variant) => {
                    return variant.sku.includes(fullSku) || variant.sku.toLowerCase().indexOf(skuFragment.toLowerCase()) !== fragmentIndex;
                });
            });

            if  (res.data.items.length > maxResults) {
                res.data.items = res.data.items.slice(0, maxResults);
            }

            return res;
        }

        return null;
    };


    // Function to get results from the API using the split SKU code
    const searchBySplitSku = async (sku) => {
        const [skuFragment1, skuFragment2] = splitSku(sku);

        // Run both API calls concurrently and wait for both to complete
        const [results1, results2] = await Promise.all([
            fetchResults(skuFragment1, sku),
            fetchResults(skuFragment2, sku),
        ]);

        return [results1, results2];
    };

    // Function to split the product title into design and type
    const splitProductTitle = (title) => {
        // Replace non-standard hyphen (en dash) with a standard hyphen (DE / FR regions)
        title = title.replace(/–/g, '-');

        // Split the title using hyphens surrounded by spaces
        const parts = title.split(' - ').map(part => part.trim());

        // Find the first part that starts with a number followed by a capital letter, a number followed by a lowercase letter, or a capital letter followed by a lowercase letter or a hyphen
        // const firstCapitalizedPartIndex = parts.findIndex(part => /^(\d+[A-Z]|\d+[a-z]|[A-Z\d]([a-z\d]|-))/.test(part));
        const firstCapitalizedPartIndex = parts.findIndex(part => /^(\d+[A-Z]|\d+[a-z]|[A-Z\d]([a-z\d]|-)|[A-Z]\s+[A-Za-z\d])/.test(part));

        // If there's no such part or it's the first part, return null
        if (firstCapitalizedPartIndex === -1 || firstCapitalizedPartIndex === 0) {
            return null;
        }

        // Reconstruct the two parts of the title
        const firstPart = parts.slice(0, firstCapitalizedPartIndex).join(' - ');
        const secondPart = parts.slice(firstCapitalizedPartIndex).join(' - ');

        // Convert the first part to sentence case
        const sentenceCaseDesign = firstPart.toLowerCase().replace(/(^\w{1})|(\s+\w{1})/g, letter => letter.toUpperCase());

        // Return an object with the two parts
        const splitTitle = {
            design: sentenceCaseDesign,
            type: secondPart
        };

        return splitTitle;
    };

    const mountSplideCarousel = (selector) => {
        const thisCarousel = document.querySelector(selector);

        // check if thisCarousel has the class is-active, if so, return true (i.e. don't remount same carousel)
        if (thisCarousel.classList.contains('is-active')) {
        return true;
        } 

        // if count is below 4, don't show arrows or pagination
        
        const splide = new Splide(thisCarousel, {
            perPage: 4,
            type: 'loop',
            drag: 'free',
            snap: true,
            padding: 0,
            gap: '2rem',
            lazyLoad: 'nearby',
            preloadPages: 1,
            clones: 0,
            breakpoints: {
                990: {
                    perPage: 3,
                    gap: '1.5rem',
                },
                600: {
                    perPage: 2,
                    gap: '1.2rem',
                },
            }
        });

        splide.on('overflow', function ( isOverflow ) {
            splide.options = {
                arrows    : isOverflow,
                pagination: isOverflow,
                drag      : isOverflow,
                clones    : isOverflow ? 2 : 0,
            };
        });

        splide.mount();

        splide.on('click', function (e) {
            const productId = e.slide.dataset.id;
            const recEventData = {
                product_id: productId,
            }
            window.sendSimilarClickEventBeacon(recEventData);
        });
    };


    const showSimilarProducts = (skuFragment) => {
        const container = document.getElementById('browse-similar-products');
        // hide all .browse-similar-products__container elements

        const titleButtons = container.querySelectorAll('.browse-similar-products__tab-button');
        titleButtons.forEach((titleButton) => {
            titleButton.classList.remove('browse-similar-products__tab-button--active');
        });

        const activeTitleButton = container.querySelector('.browse-similar-products__tab-button[data-sku-fragment="' + skuFragment.toLowerCase() + '"]');

        if (activeTitleButton) {
            activeTitleButton.classList.add('browse-similar-products__tab-button--active');
        }

        const similarProducts = container.querySelectorAll('.browse-similar-products__container');
        similarProducts.forEach((similarProduct) => {
            similarProduct.classList.add('hidden');
        });

        const activeSimilarProducts = container.querySelector('.browse-similar-products__container[data-sku-fragment="' + skuFragment + '"]');
        activeSimilarProducts.classList.remove('hidden');
        
        mountSplideCarousel('.splide[data-sku-fragment="' + skuFragment + '"]');
    }


    // Function to create title buttons for similar products
    function createTitleButtons(splitTitle, resultCounts, productSku) {
        const container = document.getElementById('browse-similar-products');
        const content = container.querySelector('.browse-similar-products__content');
        const skuElements = splitSku(productSku);

        // Create a new ul element
        const ul = document.createElement('ul');
        ul.classList.add('browse-similar-products__tab-group');
        ul.classList.add('list-unstyled');

        // Create a click event handler for the buttons
        function onButtonClick(event) {
            const skuFragment = event.target.getAttribute('data-sku-fragment').toLowerCase();
            showSimilarProducts(skuFragment);
        }

        // Create buttons for each part of the split title and append them to the ul
        Object.values(splitTitle).forEach((part, index) => {
            const li = document.createElement('li');
            li.classList.add('browse-similar-products__tab-item');
            const button = document.createElement('button');
            button.classList.add('browse-similar-products__tab-button');
            button.setAttribute('data-sku-fragment', skuElements[index].toLowerCase());
            button.innerHTML = `<span class="item-label">${part}</span><span class="item-count">(${resultCounts[index]})</span>`;
            button.addEventListener('click', onButtonClick);
            if (resultCounts[index] === 0) {
                button.setAttribute('disabled', true);
            }
            li.appendChild(button);
            ul.appendChild(li);
        });

        // Append the ul to the content container
        content.appendChild(ul);
    }

    // Function to render the results and filter out the current SKU
    const renderResults = (results, productSku, productTitle) => {
        const similarProductsPlaceholder = document.querySelector('.browse-similar-products__content');

        // Create heading
        const heading = document.createElement('h2');
        heading.classList.add('h1');
        heading.classList.add('center');

        // get data-title from #browse-similar-products
        const similarProductsTitle = document.getElementById('browse-similar-products').getAttribute('data-title');

        if (similarProductsTitle && similarProductsTitle.length > 0) {
            heading.innerText = similarProductsTitle;
            similarProductsPlaceholder.appendChild(heading);
        }

        const splitTitle = splitProductTitle(productTitle);
        const resultCounts = results.map(result => result.data.items.length);
        createTitleButtons(splitTitle, resultCounts, productSku);

        results.forEach((result) => {
            const fragmentIndex = productSku.toLowerCase().indexOf(result.data.query.toLowerCase());

            const filteredItems = result.data.items.filter((item) => {
                return !item.variants.some((variant) => variant.sku.includes(productSku));
            });

            // Create outer Splide elements
            const splideSection = document.createElement('section');
            splideSection.classList.add('splide');
            
            const splideTrack = document.createElement('div');
            splideTrack.classList.add('splide__track');

            const similarProductsContainer = document.createElement('div');
            similarProductsContainer.classList.add('browse-similar-products__container');
            similarProductsContainer.classList.add('splide');

            similarProductsContainer.setAttribute('data-sku-fragment', result.data.query);

            const list = document.createElement('ul');
            list.classList.add('list-unstyled');
            list.classList.add('similar-products__list');
            list.classList.add('splide__list');

            filteredItems.forEach((item) => {
                const listItem = document.createElement('li');
                listItem.classList.add('splide__slide');
                listItem.dataset.id = item.id;
                itemContainer = document.createElement('div');

                const link = document.createElement('a');
                link.href = `${window.Shopify.routes.root}products/${item.urlName}`;

                const imageContainer = document.createElement('div');
                imageContainer.classList.add('similar-products__image');

                const image = document.createElement('img');
                image.src = item.images[0].url;
                image.width = 200;
                image.height = 200;
                image.alt = item.title;

                // need to style the title here
                const productName = document.createElement('div');
                productName.classList.add('similar-products__product-name');

                const splitTitle = splitProductTitle(item.title)

                if (splitTitle) {
                    productName.innerHTML = `
                    <span class="split-product-title-family">${splitTitle.design}</span>
                    <span class="split-product-title-divider visually-hidden"> - </span>
                    <span class="split-product-title-item">${splitTitle.type}</span>`;
                } else {
                    productName.innerText = item.title;
                }

  
                // price (only show if GBP or USD)
                const currentCurrency =  window.Shopify.currency.active;
                let price = null;
                if (currentCurrency === 'USD' || currentCurrency === 'GBP') {
                    // check for sale price (compareAtPrice)
                    const compareAtPrice = item.variants[0].compareAtPrice;
                    const salePrice = item.variants[0].price;
                    const onOffer = compareAtPrice > salePrice;

                    price = document.createElement('div');
                    price.classList.add('similar-products__price');

                    if (onOffer) {
                        const savingPercent = Math.round(((compareAtPrice - salePrice) / compareAtPrice) * 100);
                        let priceText = '';

                        priceText += `<s class="similar-products__price-was">${priceFormatter(compareAtPrice)}</s>`;
                        priceText += `<span class="similar-products__price-now">${priceFormatter(salePrice)}</span>`;
                        priceText += `<span class="similar-products__price-save">
                            SAVE: ${savingPercent}%
                        </span>`;
                        
                        price.innerHTML = priceText;
                    } else {
                        price.innerText = priceFormatter(item.variants[0].price);
                    }
                    
                    // add sale bade to imageContainer
                    if (onOffer) {
                        const saleBadge = document.createElement('div');
                        saleBadge.classList.add('card__badge');
                        saleBadge.innerHTML = `<span class="badge color-accent-2">Sale</span>`;
                        imageContainer.appendChild(saleBadge);
                    }
                }


                imageContainer.appendChild(image);
                
                itemContainer.appendChild(imageContainer);
                link.appendChild(productName);


            
                itemContainer.appendChild(link);
                if (price) {
                    itemContainer.appendChild(price);
                }
                listItem.appendChild(itemContainer);
                list.appendChild(listItem);
            });

            splideSection.appendChild(splideTrack);
            splideTrack.appendChild(list);
            similarProductsContainer.appendChild(splideTrack);
            similarProductsPlaceholder.appendChild(similarProductsContainer);
        });
    };

    // Find #browse-similar-products and get the data-product-sku and data-product-title attributes
    const similarProductsContainer = document.querySelector('#browse-similar-products');
    const productSku = similarProductsContainer.getAttribute('data-product-sku');
    const productTitle = similarProductsContainer.getAttribute('data-product-title');

    if (typeof productSku !== 'string' || productSku.length !== 8) {
        throw new Error('Invalid SKU');
    }

    if (!productTitle || productTitle.length === 0) {
        throw new Error('Invalid product title');
    }

    // Determine the initial SKU fragment based on search results
    function determineInitialSkuFragment(results, productSku) {
        const firstSkuResultCount = results[0].data.items.length;
        const secondSkuResultCount = results[1].data.items.length;

        const skuElements = splitSku(productSku);
        const [firstSkuFragment, secondSkuFragment] = skuElements.map(sku => sku.toLowerCase());

        if (firstSkuResultCount >= 1) {
            return firstSkuFragment;
        } else if (firstSkuResultCount < 1 && secondSkuResultCount > 1) {
            return secondSkuFragment;
        }

        return null;
    }

    // Initialize render and show functions based on search results
    const initializeFunctions = (productSku) => {
        searchBySplitSku(productSku).then((results) => {
            const initialSkuFragment = determineInitialSkuFragment(results, productSku);

            if (initialSkuFragment) {
                renderResults(results, productSku, productTitle);
                showSimilarProducts(initialSkuFragment);
            }
        });
    }

    // lets go!
    initializeFunctions(productSku);
     
})();